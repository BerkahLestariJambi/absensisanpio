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
  const [pesan, setPesan] = useState("⚡ Turbo Mode");
  const [jarakWajah, setJarakWajah] = useState<"pas" | "jauh" | "dekat" | "none">("none");
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const router = useRouter();

  const videoConstraints = {
    width: 320,
    height: 480,
    facingMode: "user" as const,
  };

  // 1. AUTO LOCK GPS & LOAD MODELS
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
      } catch (err) {
        setPesan("Gagal Load AI");
      }
    };
    loadModels();

    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => console.error("GPS Error:", err),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // 2. DETEKSI WAJAH & AUTO SUBMIT
  useEffect(() => {
    let interval: any;
    if (view === "absen" && modelsLoaded && !isProcessing) {
      const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.5 });

      interval = setInterval(async () => {
        if (webcamRef.current?.video?.readyState === 4) {
          const video = webcamRef.current.video;
          const detection = await faceapi.detectSingleFace(video, detectorOptions);

          if (!detection) {
            setJarakWajah("none");
            setPesan("Mencari Wajah...");
          } else {
            const { width } = detection.box;
            if (width < 85) { 
              setJarakWajah("jauh"); 
              setPesan("Dekatkan Wajah");
            } else if (width > 280) { 
              setJarakWajah("dekat"); 
              setPesan("Terlalu Dekat");
            } else {
              setJarakWajah("pas");
              setPesan("⚡ TERDETEKSI!");
              
              if (coords) {
                setIsProcessing(true);
                clearInterval(interval);
                sendToServer(coords.lat, coords.lng);
              }
            }
          }
        }
      }, 100); 
    }
    return () => clearInterval(interval);
  }, [view, modelsLoaded, isProcessing, coords]);

  const sendToServer = async (lat: number, lng: number) => {
    setPesan("🚀 Mengirim...");
    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      
      const responseData = await res.json().catch(() => ({}));

      if (res.ok) {
        Swal.fire({ title: "Berhasil!", text: "Absen tercatat.", icon: "success", timer: 1500, showConfirmButton: false });
        router.push("/dashboard-absensi");
      } else {
        throw new Error(responseData.message || "Ditolak Server");
      }
    } catch (e: any) {
      setIsProcessing(false);
      setJarakWajah("none");
      Swal.fire("Gagal", e.message, "error");
    }
  };

  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik">
        <div className="w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-20 h-20 bg-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-xl mb-4">
            <span className="text-white text-3xl font-black italic">⚡</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Turbo Absen</h1>
          
          <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">Status Koordinat:</p>
            <p className={`text-[12px] font-mono font-bold ${coords ? "text-green-600" : "text-red-500 animate-pulse"}`}>
              {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "🛰️ MENCARI SATELIT..."}
            </p>
          </div>
          
          <div className="space-y-4 mt-8">
            <button 
              disabled={!modelsLoaded || !coords}
              onClick={() => setView("absen")} 
              className={`w-full py-4 ${modelsLoaded && coords ? 'bg-red-600 hover:scale-105 active:scale-95' : 'bg-slate-300'} text-white rounded-2xl font-black shadow-lg transition-all`}
            >
              {modelsLoaded && coords ? "🚀 MULAI ABSEN" : "MENGUNCI SISTEM..."}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center p-4 relative bg-batik overflow-hidden">
      {/* Tombol Batal Tetap di Atas */}
      <div className="w-full max-w-md flex justify-start mt-4 mb-4">
        <button onClick={() => { setView("menu"); setIsProcessing(false); }} className="bg-red-600 px-4 py-2 rounded-xl text-white text-[10px] font-black shadow-lg z-50">
          ← BATAL
        </button>
      </div>

      {/* Frame Kamera Lebih ke Atas */}
      <div className="relative w-full max-w-md aspect-[3/4] rounded-[40px] overflow-hidden border-4 border-white bg-slate-900 shadow-2xl mb-20">
        <Webcam ref={webcamRef} audio={false} videoConstraints={videoConstraints} className="w-full h-full object-cover" />
        
        {/* Indikator Status (Tanpa Bulatan Tengah) */}
        <div className="absolute top-0 w-full p-4 z-30">
          <div className={`text-center py-2 rounded-2xl backdrop-blur-md border ${jarakWajah === 'pas' ? 'bg-green-500/20 border-green-400' : 'bg-black/20 border-white/20'}`}>
            <span className="text-[11px] text-white font-black uppercase italic tracking-widest">{pesan}</span>
          </div>
        </div>
      </div>

      {/* Watermark/Info di Bawah Kamera */}
      <div className="w-full max-w-md px-6 text-center opacity-30">
        <p className="text-slate-800 font-black text-[10px] tracking-[0.3em] uppercase italic">Sanpio High-Speed System</p>
      </div>

      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }
        .animate-spin-slow { animation: spin 3s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
