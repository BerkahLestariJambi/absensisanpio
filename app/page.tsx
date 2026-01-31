"use client";
import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

export default function HomeAbsensi() {
  const [view, setView] = useState<"menu" | "absen">("menu");
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pesan, setPesan] = useState("Menyiapkan Sistem...");
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [config, setConfig] = useState<any>(null);
  
  const router = useRouter();
  const videoConstraints = { width: 320, height: 480, facingMode: "user" as const };

  // --- 1. LOAD AI, GEOLOCATION, & SETTINGS ---
  useEffect(() => {
    const loadSistem = async () => {
      try {
        const configRes = await fetch("https://backendabsen.mejatika.com/api/setting-app");
        const configData = await configRes.json();
        if (configData.success) setConfig(configData.data);

        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        const res = await fetch("https://backendabsen.mejatika.com/api/admin/guru/referensi");
        const gurus = await res.json();

        const labeledDescriptors = await Promise.all(
          gurus.map(async (guru: any) => {
            if (!guru.foto_referensi) return null;
            try {
              const imgUrl = `https://backendabsen.mejatika.com/storage/${guru.foto_referensi}`;
              const img = await faceapi.fetchImage(imgUrl);
              // Optimasi: Gunakan detektor yang lebih cepat untuk registrasi awal
              const fullDesc = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
              return fullDesc ? new faceapi.LabeledFaceDescriptors(guru.id.toString(), [fullDesc.descriptor]) : null;
            } catch (e) { return null; }
          })
        );

        const validDescriptors = labeledDescriptors.filter(d => d !== null) as faceapi.LabeledFaceDescriptors[];
        if (validDescriptors.length > 0) {
          setFaceMatcher(new faceapi.FaceMatcher(validDescriptors, 0.6));
          if (view === "menu") setPesan("⚡ Scanner Siap");
        }
      } catch (err) { 
        console.error("Init Error:", err);
        setPesan("Gagal memuat sistem");
      }
    };
    loadSistem();

    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        null, 
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // --- 2. ENGINE SCANNER (OPTIMIZED SPEED) ---
  useEffect(() => {
    let interval: any;
    if (view === "absen" && !isProcessing) {
      // Menaikkan frekuensi deteksi (dari 200ms ke 100ms) untuk scan lebih cepat
      interval = setInterval(async () => {
        if (webcamRef.current?.video?.readyState === 4 && canvasRef.current) {
          const video = webcamRef.current.video;
          const canvas = canvasRef.current;
          const displaySize = { width: video.videoWidth, height: video.videoHeight };
          faceapi.matchDimensions(canvas, displaySize);

          // Gunakan inputSize kecil (160) agar proses deteksi sangat cepat
          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          const ctx = canvas.getContext("2d");
          ctx?.clearRect(0, 0, canvas.width, canvas.height);

          if (detection) {
            const resizedDetection = faceapi.resizeResults(detection, displaySize);
            const { x, y, width, height } = resizedDetection.detection.box;

            if (ctx) {
              ctx.strokeStyle = "#00f2ff"; ctx.lineWidth = 3;
              ctx.strokeRect(x, y, width, height);
            }

            // Area deteksi diperluas (80-280) agar guru tidak perlu terlalu presisi maju-mundur
            if (width >= 80 && width <= 280) {
              setPesan("Fokus Terkunci...");
              if (faceMatcher && !isProcessing) {
                const match = faceMatcher.findBestMatch(detection.descriptor);
                if (match.label !== "unknown") {
                  setIsProcessing(true);
                  clearInterval(interval);
                  setPesan("Sinkronisasi Biometrik...");
                  // Timeout dikurangi ke 800ms agar terasa instant
                  setTimeout(() => handleRecognitionSuccess(match.label), 800);
                }
              }
            } else {
              setPesan(width < 80 ? "Dekatkan Wajah..." : "Terlalu Dekat!");
            }
          } else { setPesan("Mencari Wajah..."); }
        }
      }, 100); 
    }
    return () => {
      clearInterval(interval);
      const ctx = canvasRef.current?.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current?.width || 0, canvasRef.current?.height || 0);
    };
  }, [view, faceMatcher, isProcessing]);

  // --- 3. LOGIKA PEMBAGIAN WAKTU (SINKRON DENGAN DATABASE) ---
  const handleRecognitionSuccess = async (guruId: string) => {
    try {
      // A. CEK RIWAYAT KE DATABASE TERLEBIH DAHULU
      // Ganti URL ini dengan endpoint cek status yang Anda buat di Laravel
      const checkRes = await fetch(`https://backendabsen.mejatika.com/api/cek-status-absen/${guruId}`);
      const checkData = await checkRes.json();

      const jamWita = new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Makassar', hour: 'numeric', minute: 'numeric', hour12: false
      }).format(new Date());

      const [h, m] = jamWita.replace('.', ':').split(':').map(Number);
      const totalMenit = h * 60 + m;

      const parseConfig = (t: string) => {
          if(!t) return 0;
          const [hh, mm] = t.split(':').map(Number);
          return hh * 60 + mm;
      }

      const jamPulangCepat = parseConfig(config?.jam_pulang_cepat_mulai || "07:15");
      const jamPulangNormal = parseConfig(config?.jam_pulang_normal || "12:45");

      // B. POPUP HANYA MUNCUL JIKA SUDAH PERNAH ABSEN MASUK
      if (checkData.jumlah_absen > 0 && totalMenit >= jamPulangCepat && totalMenit < jamPulangNormal) {
        const { value: status } = await Swal.fire({
          title: "KONFIRMASI PULANG",
          text: "Pilih alasan Anda pulang lebih awal:",
          icon: "question",
          input: "select",
          inputOptions: {
            "Izin": "Izin (Pulang Cepat)",
            "Sakit": "Sakit (Pulang Cepat)",
          },
          inputPlaceholder: "-- Pilih Status --",
          showCancelButton: true,
          confirmButtonColor: "#3085d6",
          confirmButtonText: "Kirim Absen",
          allowOutsideClick: false
        });

        if (status) {
          sendToServer(guruId, coords?.lat || 0, coords?.lng || 0, status);
        } else {
          setView("menu"); setIsProcessing(false);
        }
      } else {
        // Jika belum ada absen (jumlah_absen = 0) atau sudah jam pulang normal, langsung kirim
        sendToServer(guruId, coords?.lat || 0, coords?.lng || 0);
      }
    } catch (e) {
      console.error("Check Error:", e);
      // Fallback: Langsung kirim jika API cek gagal
      sendToServer(guruId, coords?.lat || 0, coords?.lng || 0);
    }
  };

  // --- 4. KIRIM DATA KE BACKEND ---
  const sendToServer = async (guruId: string, lat: number, lng: number, statusTambahan?: string) => {
    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guru_id: guruId, lat, lng, status_tambahan: statusTambahan }),
      });
      const data = await res.json();
      
      await Swal.fire({
        title: res.ok ? "BERHASIL" : "GAGAL",
        text: data.message,
        icon: res.ok ? "success" : "warning",
        timer: 2000,
        showConfirmButton: false
      });

      if (res.ok) {
        router.push("/dashboard-absensi");
      } else {
        setView("menu"); setIsProcessing(false);
      }
    } catch (e) {
      Swal.fire("Error", "Koneksi Bermasalah", "error");
      setView("menu"); setIsProcessing(false);
    }
  };

  // --- UI MENU & SCANNER (TETAP SAMA DENGAN FITUR LAMA) ---
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik">
        <div className="w-full max-w-sm bg-white/95 rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center overflow-hidden bg-slate-50 rounded-2xl shadow-inner">
            {config?.logo_sekolah ? (
                <img src={`https://backendabsen.mejatika.com/storage/${config.logo_sekolah}`} alt="Logo" className="max-h-full object-contain" />
            ) : (
                <div className="text-5xl opacity-20">👤</div>
            )}
          </div>
          
          <h2 className="text-lg font-bold text-slate-700 leading-tight uppercase mb-1">
            {config?.nama_sekolah || "Memuat..."}
          </h2>
          <p className="text-[10px] text-slate-500 font-medium mb-6 uppercase tracking-widest">
            TP {config?.tahun_pelajaran || "-"} | SEMESTER {config?.semester || "-"}
          </p>

          <button 
            disabled={!faceMatcher}
            onClick={() => setView("absen")} 
            className={`w-full py-5 ${!faceMatcher ? 'bg-slate-400' : 'bg-red-600 hover:bg-red-700'} text-white rounded-2xl font-black shadow-lg transition-all text-lg flex items-center justify-center gap-3`}
          >
            <span className="text-2xl">👤</span> {faceMatcher ? "ABSEN SEKARANG" : "LOADING AI..."}
          </button>
          
          <button onClick={() => router.push("/admin/login")} className="mt-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-red-600 transition-all block w-full text-center">
            🔐 Admin Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center p-4 relative bg-batik overflow-hidden">
      <div className="w-full max-w-md flex justify-start mt-2 mb-2">
        <button onClick={() => { setView("menu"); setIsProcessing(false); }} className="bg-red-600 px-4 py-2 rounded-xl text-white text-[10px] font-black z-50 shadow-lg">← KEMBALI</button>
      </div>

      <div className="relative w-full max-w-md aspect-[3/4] rounded-[40px] overflow-hidden border-4 border-white bg-slate-900 shadow-2xl mb-6">
        <Webcam ref={webcamRef} audio={false} videoConstraints={videoConstraints} className="absolute inset-0 w-full h-full object-cover" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />
        <div className={`absolute left-0 w-full h-[4px] bg-cyan-400 shadow-[0_0_25px_#00f2ff] z-20 ${isProcessing ? 'animate-fast-scan' : 'animate-slow-scan'}`}></div>

        <div className="absolute bottom-0 w-full z-30 bg-gradient-to-t from-black/95 via-black/40 to-transparent pt-12 pb-6 px-6">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 shadow-2xl text-center">
                <div className="flex justify-between items-center mb-3 text-white">
                    <div className="text-left">
                        <p className="text-[8px] text-cyan-400 font-bold uppercase">Latitude</p>
                        <p className="text-[10px] font-mono font-bold">{coords?.lat.toFixed(6) || "..."}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] text-cyan-400 font-bold uppercase">Longitude</p>
                        <p className="text-[10px] font-mono font-bold">{coords?.lng.toFixed(6) || "..."}</p>
                    </div>
                </div>
                <span className="text-[14px] font-black uppercase italic tracking-tighter text-amber-300">{pesan}</span>
            </div>
        </div>
      </div>

      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }
        .animate-slow-scan { animation: scan 3s ease-in-out infinite; }
        .animate-fast-scan { animation: scan 0.8s linear infinite; background: #fff; box-shadow: 0 0 40px #fff; }
        @keyframes scan { 0% { top: 5%; } 50% { top: 95%; } 100% { top: 5%; } }
      `}</style>
    </div>
  );
}
