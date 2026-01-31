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
  
  // State untuk Pengaturan Dinamis dari Backend
  const [config, setConfig] = useState<any>(null);
  
  const router = useRouter();
  const videoConstraints = { width: 320, height: 480, facingMode: "user" as const };

  // --- 1. LOAD AI, GEOLOCATION, & SETTINGS ---
  useEffect(() => {
    const loadSistem = async () => {
      try {
        // A. Load Pengaturan Sekolah
        const configRes = await fetch("https://backendabsen.mejatika.com/api/setting-app");
        const configData = await configRes.json();
        if (configData.success) setConfig(configData.data);

        // B. Load Model AI
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        // C. Load Referensi Wajah Guru
        const res = await fetch("https://backendabsen.mejatika.com/api/admin/guru/referensi");
        const gurus = await res.json();

        const labeledDescriptors = await Promise.all(
          gurus.map(async (guru: any) => {
            if (!guru.foto_referensi) return null;
            try {
              const imgUrl = `https://backendabsen.mejatika.com/storage/${guru.foto_referensi}`;
              const img = await faceapi.fetchImage(imgUrl);
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
      } catch (err) { console.error("Init Error:", err); }
    };
    loadSistem();

    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition((pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }), null, { enableHighAccuracy: true });
    }
  }, []);

  // --- 2. ENGINE SCANNER + FRAME LOCK ---
  useEffect(() => {
    let interval: any;
    if (view === "absen" && !isProcessing) {
      interval = setInterval(async () => {
        if (webcamRef.current?.video?.readyState === 4 && canvasRef.current) {
          const video = webcamRef.current.video;
          const canvas = canvasRef.current;
          const displaySize = { width: video.videoWidth, height: video.videoHeight };
          faceapi.matchDimensions(canvas, displaySize);

          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
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
              ctx.fillStyle = "#00f2ff";
              ctx.fillRect(x - 5, y - 5, 20, 5); ctx.fillRect(x - 5, y - 5, 5, 20);
              ctx.fillRect(x + width - 15, y - 5, 20, 5); ctx.fillRect(x + width, y - 5, 5, 20);
            }

            if (width >= 100 && width <= 250) {
              setPesan("Fokus Terkunci...");
              if (faceMatcher && !isProcessing) {
                const match = faceMatcher.findBestMatch(detection.descriptor);
                if (match.label !== "unknown") {
                  setIsProcessing(true);
                  clearInterval(interval);
                  setPesan("Sinkronisasi Biometrik...");
                  setTimeout(() => handleRecognitionSuccess(match.label), 1200);
                }
              }
            } else {
              setPesan(width < 100 ? "Dekatkan Wajah..." : "Terlalu Dekat!");
            }
          } else { setPesan("Mencari Wajah..."); }
        }
      }, 200);
    }
    return () => {
      clearInterval(interval);
      const ctx = canvasRef.current?.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current?.width || 0, canvasRef.current?.height || 0);
    };
  }, [view, faceMatcher, isProcessing]);

  // --- 3. LOGIKA PEMBAGIAN WAKTU (MASUK vs PULANG) ---
  const handleRecognitionSuccess = async (guruId: string) => {
    const sekarang = new Date();
    const totalMenit = sekarang.getHours() * 60 + sekarang.getMinutes();

    // Ambil jam dari config atau default jika config belum load
    const jamPulangCepat = config?.jam_pulang_cepat_mulai ? parseInt(config.jam_pulang_cepat_mulai.split(':')[0]) * 60 + parseInt(config.jam_pulang_cepat_mulai.split(':')[1]) : 435;
    const jamPulangNormal = config?.jam_pulang_normal ? parseInt(config.jam_pulang_normal.split(':')[0]) * 60 + parseInt(config.jam_pulang_normal.split(':')[1]) : 765;

    // Jika di jam Pulang Cepat (Misal 07:15 - 12:44)
    if (totalMenit >= jamPulangCepat && totalMenit < jamPulangNormal) {
      const { value: status } = await Swal.fire({
        title: "KONFIRMASI ABSENSI",
        text: "Pilih jenis absensi Anda saat ini:",
        icon: "question",
        input: "select",
        inputOptions: {
          "MASUK": "Absen Masuk (Terlambat)",
          "Izin": "Izin (Pulang Cepat)",
          "Sakit": "Sakit (Pulang Cepat)",
        },
        inputPlaceholder: "-- Pilih Status --",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        allowOutsideClick: false
      });

      if (status) {
        // Jika pilih MASUK, kirim status_tambahan undefined agar backend memproses sebagai Masuk
        const statusKirim = status === "MASUK" ? undefined : status;
        sendToServer(guruId, coords?.lat || 0, coords?.lng || 0, statusKirim);
      } else {
        setView("menu"); setIsProcessing(false);
      }
    } else {
      // Diluar jam tersebut (Masuk Normal atau Pulang Normal), langsung kirim
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

  // --- UI LAYAR UTAMA (MENU) ---
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik">
        <div className="w-full max-w-sm bg-white/95 rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          {/* Logo Sekolah Dinamis */}
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center overflow-hidden">
            {config?.logo_sekolah ? (
                <img src={`https://backendabsen.mejatika.com/storage/${config.logo_sekolah}`} alt="Logo" className="max-h-full object-contain" />
            ) : (
                <div className="text-5xl">👤</div>
            )}
          </div>
          
          <h2 className="text-lg font-bold text-slate-700 leading-tight uppercase mb-1">
            {config?.nama_sekolah || "Memuat..."}
          </h2>
          <p className="text-[10px] text-slate-500 font-medium mb-6 uppercase tracking-widest">
            {config?.tahun_pelajaran || "..."} | SEMESTER {config?.semester || "..."}
          </p>

          <button onClick={() => setView("absen")} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-lg transition-all text-lg flex items-center justify-center gap-3">
            <span className="text-2xl">👤</span> ABSEN SEKARANG
          </button>
          
          <button onClick={() => router.push("/admin/login")} className="mt-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-red-600 transition-all block w-full text-center">
            🔐 Admin Login
          </button>
        </div>
      </div>
    );
  }

  // --- UI LAYAR SCANNER ---
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
                        <p className="text-[10px] font-mono font-bold">{coords?.lat.toFixed(6) || "Mencari..."}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] text-cyan-400 font-bold uppercase">Longitude</p>
                        <p className="text-[10px] font-mono font-bold">{coords?.lng.toFixed(6) || "Mencari..."}</p>
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
