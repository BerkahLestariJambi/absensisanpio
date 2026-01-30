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

  const schoolCoords = { lat: -6.2000, lng: 106.8000 };
  const maxRadius = 50;

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Gagal load model AI:", err);
        setPesan("Gagal memuat sistem AI");
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    let interval: any;
    if (view === "absen" && modelsLoaded && !isProcessing) {
      interval = setInterval(async () => {
        if (webcamRef.current && webcamRef.current.video?.readyState === 4) {
          const video = webcamRef.current.video;
          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());

          if (!detection) {
            setJarakWajah("none");
          } else {
            const { width } = detection.box;
            if (width < 130) setJarakWajah("jauh");
            else if (width > 260) setJarakWajah("dekat");
            else {
              setJarakWajah("pas");
              if (coords && !isProcessing) {
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
    setTimeout(() => {
      if (webcamRef.current) {
        const image = webcamRef.current.getScreenshot();
        if (image && coords) ambilFotoOtomatis(image, coords.lat, coords.lng);
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
        if (distance <= maxRadius) setPesan("Lokasi Sesuai");
        else {
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
      } else throw new Error("Gagal kirim");
    } catch (error) {
      setIsProcessing(false);
      setJarakWajah("none");
      Swal.fire("Error", "Gagal mengirim data ke server.", "error");
    }
  };

  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik">
        <div className="w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-20 h-20 bg-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-xl mb-4">
            <span className="text-white text-3xl font-black">S</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Sanpio System</h1>
          <p className="text-amber-800 font-bold text-[10px] tracking-widest mt-1 mb-8 italic">PANCASILA & BUDAYA</p>
          <div className="space-y-4">
            <button 
              disabled={!modelsLoaded}
              onClick={() => { setView("absen"); getInitialLocation(); }} 
              className={`w-full py-4 ${modelsLoaded ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-300'} text-white rounded-2xl font-bold shadow-lg transition-all active:scale-95`}
            >
              {modelsLoaded ? "🚀 MULAI ABSENSI" : "MENYIAPKAN AI..."}
            </button>
            <button onClick={() => router.push("/admin/login")} className="w-full py-4 bg-white text-slate-700 border-2 border-amber-100 rounded-2xl font-bold hover:bg-amber-50 transition-all active:scale-95">
              🔐 LOGIN ADMIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-4 relative font-sans bg-batik">
      <button onClick={() => { setView("menu"); setJarakWajah("none"); setIsProcessing(false); }} className="absolute top-6 left-6 z-50 bg-red-600 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-lg active:scale-90">
        ← BATAL
      </button>

      <div className="relative w-full max-w-md aspect-[3/4] rounded-[30px] overflow-hidden border-4 border-white bg-slate-900 shadow-2xl">
        <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} className="w-full h-full object-cover grayscale-[0.2]" />
        
        {/* FRAME SCANNER */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className={`relative w-72 h-72 transition-all duration-500 ${jarakWajah === 'pas' ? 'scale-105' : 'scale-100'}`}>
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-red-600 rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-red-600 rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-red-600 rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-red-600 rounded-br-xl"></div>
                <div className="absolute w-full h-[2px] bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.9)] animate-scan-red"></div>
            </div>
        </div>

        {/* OVERLAY KOORDINAT & INSTRUKSI */}
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-between py-10 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md border border-amber-200 px-6 py-3 rounded-2xl shadow-xl">
            <p className="text-red-600 font-black text-sm tracking-widest uppercase">
              {jarakWajah === "pas" && "✅ Posisi Pas! Tahan..."}
              {jarakWajah === "jauh" && "❌ Dekatkan Wajah"}
              {jarakWajah === "dekat" && "❌ Terlalu Dekat"}
              {jarakWajah === "none" && "🔍 Mencari Wajah..."}
            </p>
          </div>

          <div className="w-full px-6 space-y-3">
            {/* BOX KOORDINAT */}
            <div className="bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center">
               <div className="flex justify-around items-center">
                  <div className="text-left">
                    <p className="text-[9px] text-red-400 font-bold uppercase tracking-widest">Latitude</p>
                    <p className="text-xs font-mono text-white font-bold">{coords ? coords.lat.toFixed(6) : "Fetching..."}</p>
                  </div>
                  <div className="w-[1px] h-8 bg-white/20"></div>
                  <div className="text-left">
                    <p className="text-[9px] text-red-400 font-bold uppercase tracking-widest">Longitude</p>
                    <p className="text-xs font-mono text-white font-bold">{coords ? coords.lng.toFixed(6) : "Fetching..."}</p>
                  </div>
               </div>
               <p className="text-[10px] text-amber-200 mt-2 font-bold tracking-tighter uppercase italic">{pesan}</p>
            </div>
            
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden w-full mx-auto">
              <div className={`h-full bg-red-600 transition-all duration-700 ${jarakWajah === "pas" ? "w-full" : "w-0"}`}></div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .bg-batik {
          background-color: #fdf5e6;
          background-image: url("https://www.transparenttextures.com/patterns/batik.png");
        }
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
