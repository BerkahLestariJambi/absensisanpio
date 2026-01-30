"use client";
import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

export default function HomeAbsensi() {
  const [view, setView] = useState<"menu" | "absen">("menu");
  const webcamRef = useRef<Webcam>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pesan, setPesan] = useState("Mencari Sinyal GPS...");
  const [jarakWajah, setJarakWajah] = useState<"pas" | "jauh" | "dekat" | "none">("none");
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const router = useRouter();

  // Koordinat Sekolah
  const schoolCoords = { lat: -6.2000, lng: 106.8000 };
  const maxRadius = 50;

  // 1. LOAD MODELS (Pastikan file ada di public/models)
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        // Memastikan face-api hanya berjalan di client side
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Gagal load model AI:", err);
        setPesan("Gagal memuat sistem AI");
      }
    };
    loadModels();
  }, []);

  // 2. DETEKSI BIOMETRIK REAL-TIME
  useEffect(() => {
    let interval: any;
    
    if (view === "absen" && modelsLoaded && !isProcessing) {
      interval = setInterval(async () => {
        if (webcamRef.current && webcamRef.current.video?.readyState === 4) {
          const video = webcamRef.current.video;
          
          const detection = await faceapi.detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions()
          );

          if (!detection) {
            setJarakWajah("none");
          } else {
            const { width } = detection.box;
            
            // Logika akurasi jarak biometrik
            if (width < 130) {
              setJarakWajah("jauh");
            } else if (width > 260) {
              setJarakWajah("dekat");
            } else {
              setJarakWajah("pas");
              // Auto-capture jika GPS sudah terkunci
              if (coords && !isProcessing) {
                // Hentikan interval segera setelah posisi "pas" ditemukan
                clearInterval(interval); 
                handleAutoCapture();
              }
            }
          }
        }
      }, 600);
    }
    return () => clearInterval(interval);
  }, [view, modelsLoaded, coords, isProcessing]);

  const handleAutoCapture = () => {
    // Delay 1.5 detik agar user sempat melihat instruksi "POSISI PAS"
    setTimeout(() => {
      if (webcamRef.current) {
        const image = webcamRef.current.getScreenshot();
        if (image && coords) {
          ambilFotoOtomatis(image, coords.lat, coords.lng);
        }
      }
    }, 1500);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const getInitialLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const distance = calculateDistance(pos.coords.latitude, pos.coords.longitude, schoolCoords.lat, schoolCoords.lng);
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        
        if (distance <= maxRadius) {
          setPesan("Lokasi Sesuai");
        } else {
          setPesan("Di Luar Area");
          Swal.fire("Akses Ditolak", `Jarak Anda ${Math.round(distance)}m dari sekolah.`, "error");
        }
      },
      () => Swal.fire("GPS Error", "Aktifkan GPS Anda!", "error"),
      { enableHighAccuracy: true }
    );
  };

  const ambilFotoOtomatis = async (image: string, lat: number, lng: number) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, lat, lng }),
      });
      
      if (res.ok) {
        Swal.fire({ title: "Berhasil!", text: "Absensi Terekam", icon: "success", timer: 1500, showConfirmButton: false });
        router.push("/admin/dashboard");
      } else {
        throw new Error("Gagal kirim");
      }
    } catch (error) {
      setIsProcessing(false);
      setJarakWajah("none"); // Reset agar bisa coba lagi
      Swal.fire("Error", "Gagal mengirim data ke server.", "error");
    }
  };

  // Tampilan Menu
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-[40px] shadow-2xl p-10 text-center border border-slate-200">
          <div className="w-20 h-20 bg-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-xl mb-4">
            <span className="text-white text-3xl font-black">S</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Sanpio System</h1>
          <p className="text-slate-400 text-[10px] tracking-widest mt-1 mb-8">BIOMETRIC ATTENDANCE</p>
          
          <div className="space-y-4">
            <button 
              disabled={!modelsLoaded}
              onClick={() => { setView("absen"); getInitialLocation(); }} 
              className={`w-full py-4 ${modelsLoaded ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-300'} text-white rounded-2xl font-bold shadow-lg transition-all active:scale-95`}
            >
              {modelsLoaded ? "🚀 MULAI ABSENSI" : "MENYIAPKAN AI..."}
            </button>
            <button onClick={() => router.push("/admin/login")} className="w-full py-4 bg-white text-slate-700 border-2 border-slate-100 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95">
              🔐 LOGIN ADMIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Tampilan Kamera
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative font-sans text-white">
      <button onClick={() => { setView("menu"); setJarakWajah("none"); setIsProcessing(false); }} className="absolute top-6 left-6 z-50 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md text-xs font-bold border border-white/10">
        ← BATAL
      </button>

      <div className="relative w-full max-w-md aspect-[3/4] rounded-[30px] overflow-hidden border border-white/10 bg-slate-900 shadow-[0_0_60px_rgba(220,38,38,0.2)]">
        <Webcam 
          ref={webcamRef} 
          audio={false} 
          screenshotFormat="image/jpeg" 
          videoConstraints={{ facingMode: "user" }} 
          className="w-full h-full object-cover grayscale-[0.2]" 
        />
        
        {/* FRAME SCANNER */}
        <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className={`relative w-72 h-72 transition-all duration-500 ${jarakWajah === 'pas' ? 'scale-105' : 'scale-100'}`}>
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-red-600 rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-red-600 rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-red-600 rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-red-600 rounded-br-xl"></div>
                <div className="absolute w-full h-[2px] bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.9)] animate-scan-red"></div>
            </div>
        </div>

        {/* OVERLAY INSTRUKSI */}
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-between py-12 pointer-events-none">
          <div className="bg-black/70 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl">
            <p className="text-red-500 font-black text-sm tracking-widest uppercase">
              {jarakWajah === "pas" && "✅ Posisi Pas! Tahan..."}
              {jarakWajah === "jauh" && "❌ Dekatkan Wajah"}
              {jarakWajah === "dekat" && "❌ Terlalu Dekat"}
              {jarakWajah === "none" && "🔍 Mencari Wajah..."}
            </p>
          </div>

          <div className="w-full px-10 text-center space-y-3">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden w-48 mx-auto">
              <div className={`h-full bg-red-600 transition-all duration-700 ${jarakWajah === "pas" ? "w-full" : "w-0"}`}></div>
            </div>
            <p className="text-[10px] text-white/40 tracking-[0.4em] font-bold uppercase italic">{pesan}</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes scan-red {
          0% { top: 5%; opacity: 0.2; }
          50% { opacity: 1; }
          100% { top: 95%; opacity: 0.2; }
        }
        .animate-scan-red { animation: scan-red 2s infinite ease-in-out; }
      `}</style>
    </div>
  );
}
