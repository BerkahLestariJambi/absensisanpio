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
  
  const isLocked = useRef(false);
  const scanIntervalRef = useRef<any>(null);

  const router = useRouter();
  const videoConstraints = { width: 320, height: 480, facingMode: "user" as const };

  // --- 1. INITIAL LOAD (AI & Config) ---
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
        setPesan("Gagal memuat sistem");
      }
    };
    loadSistem();

    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        null, { enableHighAccuracy: true }
      );
    }
  }, []);

  // --- 2. ENGINE SCANNER ---
  useEffect(() => {
    if (view === "absen" && !isProcessing) {
      isLocked.current = false; 
      scanIntervalRef.current = setInterval(async () => {
        if (isProcessing || isLocked.current) return;

        if (webcamRef.current?.video?.readyState === 4 && canvasRef.current) {
          const video = webcamRef.current.video;
          const canvas = canvasRef.current;
          const displaySize = { width: video.videoWidth, height: video.videoHeight };
          faceapi.matchDimensions(canvas, displaySize);

          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          const ctx = canvas.getContext("2d");
          ctx?.clearRect(0, 0, canvas.width, canvas.height);

          if (detection) {
            const resized = faceapi.resizeResults(detection, displaySize);
            const { width, x, y, height } = resized.detection.box;

            if (ctx) {
              ctx.strokeStyle = "#00f2ff"; ctx.lineWidth = 3;
              ctx.strokeRect(x, y, width, height);
            }

            if (width >= 80 && width <= 280) {
              if (faceMatcher && !isLocked.current) {
                const match = faceMatcher.findBestMatch(detection.descriptor);
                if (match.label !== "unknown") {
                  isLocked.current = true; 
                  setIsProcessing(true);
                  clearInterval(scanIntervalRef.current); 
                  setPesan("Sinkronisasi Biometrik...");
                  handleRecognitionSuccess(match.label);
                }
              }
            } else { setPesan(width < 80 ? "Dekatkan Wajah..." : "Terlalu Dekat!"); }
          } else { setPesan("Mencari Wajah..."); }
        }
      }, 100); 
    }
    return () => clearInterval(scanIntervalRef.current);
  }, [view, faceMatcher, isProcessing]);

  // --- 3. LOGIKA PULANG CEPAT ---
  const handleRecognitionSuccess = async (guruId: string) => {
    try {
      // 1. Ambil Foto Screenshot saat wajah terdeteksi
      const screenshot = webcamRef.current?.getScreenshot();

      // 2. Cek status ke Backend
      const checkRes = await fetch(`https://backendabsen.mejatika.com/api/cek-status-absen/${guruId}`);
      const checkData = await checkRes.json();
      const jumlahAbsen = checkData.jumlah_absen || 0;

      // 3. Parsing Waktu WITA
      const jamSekarangWita = new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date());
      const [h, m] = jamSekarangWita.split(/[.:]/).map(Number);
      const totalMenitSekarang = h * 60 + m;

      const parseConfig = (t: string) => {
          if(!t) return 0;
          const [hh, mm] = t.split(/[.:]/).map(Number);
          return hh * 60 + mm;
      }

      const menitPulangCepat = parseConfig(config?.jam_pulang_cepat_mulai || "07:15");
      const menitPulangNormal = parseConfig(config?.jam_pulang_normal || "12:45");

      // Validasi Pulang Cepat
      if (jumlahAbsen > 0 && totalMenitSekarang >= menitPulangCepat && totalMenitSekarang < menitPulangNormal) {
        const { value: alasan } = await Swal.fire({
          title: "PULANG CEPAT",
          text: "Anda terdeteksi pulang mendahului jadwal. Pilih alasan:",
          icon: "warning",
          input: "select",
          inputOptions: { "Izin": "Izin", "Sakit": "Sakit" },
          inputPlaceholder: "-- Pilih Alasan --",
          showCancelButton: true,
          confirmButtonText: "Kirim",
          cancelButtonText: "Batal",
          allowOutsideClick: false,
          inputValidator: (value) => {
            if (!value) return 'Anda harus memilih alasan!';
          }
        });

        if (alasan) {
          sendToServer(guruId, coords?.lat || 0, coords?.lng || 0, screenshot, alasan);
        } else {
          resetScanner();
        }
      } else {
        // Mode Normal (Masuk atau Pulang Tepat Waktu)
        sendToServer(guruId, coords?.lat || 0, coords?.lng || 0, screenshot);
      }
    } catch (e) {
      resetScanner();
    }
  };

  const resetScanner = () => {
    isLocked.current = false;
    setIsProcessing(false);
    setView("menu");
    setPesan("⚡ Scanner Siap");
  };

  // --- 4. KIRIM KE SERVER ---
  const sendToServer = async (guruId: string, lat: number, lng: number, image?: string | null, statusTambahan?: string) => {
    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            guru_id: guruId, 
            lat, 
            lng, 
            status_tambahan: statusTambahan,
            image: image // Foto bukti wajah hasil scan (Base64)
        }),
      });
      const data = await res.json();
      
      if (res.ok) {
        await Swal.fire({
          title: "BERHASIL",
          text: data.message,
          icon: "success",
          timer: 1500,
          showConfirmButton: false
        });

        const { isConfirmed } = await Swal.fire({
          title: "Absensi Selesai",
          text: "Lihat rekap di Dashboard?",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Ya, Dashboard",
          cancelButtonText: "Kembali ke Menu",
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#aaa",
          allowOutsideClick: false
        });

        if (isConfirmed) {
          router.push("/dashboard-absensi");
        } else {
          resetScanner();
        }
      } else {
        await Swal.fire("GAGAL", data.message, "warning");
        resetScanner();
      }
    } catch (e) {
      Swal.fire("Error", "Koneksi Bermasalah", "error");
      resetScanner();
    }
  };

  // --- UI RENDER ---
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik">
        <div className="w-full max-w-sm bg-white/95 rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center overflow-hidden bg-slate-50 rounded-2xl shadow-inner">
            {config?.logo_sekolah && <img src={`https://backendabsen.mejatika.com/storage/${config.logo_sekolah}`} alt="Logo" className="max-h-full object-contain" />}
          </div>
          <h2 className="text-lg font-bold text-slate-700 leading-tight uppercase mb-1">{config?.nama_sekolah || "Memuat..."}</h2>
          <p className="text-[10px] text-slate-500 font-medium mb-6 uppercase">TP {config?.tahun_pelajaran} | SEM {config?.semester}</p>
          <button disabled={!faceMatcher} onClick={() => setView("absen")} className={`w-full py-5 ${!faceMatcher ? 'bg-slate-400' : 'bg-red-600'} text-white rounded-2xl font-black shadow-lg text-lg flex items-center justify-center gap-3 transition-all active:scale-95`}>
            <span className="text-2xl">👤</span> {faceMatcher ? "ABSEN SEKARANG" : "LOADING AI..."}
          </button>
          <button onClick={() => router.push("/admin/login")} className="mt-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest block w-full text-center">🔐 Admin Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center p-4 relative bg-batik overflow-hidden">
      <div className="w-full max-w-md flex justify-start mt-2 mb-2">
        <button onClick={resetScanner} className="bg-red-600 px-4 py-2 rounded-xl text-white text-[10px] font-black z-50">← KEMBALI</button>
      </div>
      <div className="relative w-full max-w-md aspect-[3/4] rounded-[40px] overflow-hidden border-4 border-white bg-slate-900 shadow-2xl">
        <Webcam 
          ref={webcamRef} 
          audio={false} 
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints} 
          className="absolute inset-0 w-full h-full object-cover" 
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />
        <div className={`absolute left-0 w-full h-[4px] bg-cyan-400 shadow-[0_0_25px_#00f2ff] z-20 ${isProcessing ? 'animate-fast-scan' : 'animate-slow-scan'}`}></div>
        <div className="absolute bottom-0 w-full z-30 bg-gradient-to-t from-black/95 p-6">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 text-center border border-white/20">
                <span className="text-[14px] font-black uppercase italic text-amber-300">{pesan}</span>
            </div>
        </div>
      </div>
      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }
        .animate-slow-scan { animation: scan 3s ease-in-out infinite; }
        .animate-fast-scan { animation: scan 0.8s linear infinite; background: #fff; box-shadow: 0 0 20px #fff; }
        @keyframes scan { 0% { top: 5% } 50% { top: 95% } 100% { top: 5% } }
      `}</style>
    </div>
  );
}
