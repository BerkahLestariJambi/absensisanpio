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

  // Konfigurasi Video Super Ringan
  const videoConstraints = {
    width: 320, // Resolusi rendah = AI deteksi jauh lebih cepat
    height: 480,
    facingMode: "user",
    frameRate: 30
  };

  // 1. LOAD MODEL (Hanya detector paling dasar)
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        // Hanya satu model agar tidak berat di memori
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
      } catch (err) {
        setPesan("Gagal Load AI");
      }
    };
    loadModels();
  }, []);

  // 2. DETEKSI & CAPTURE KILAT
  useEffect(() => {
    let interval: any;
    if (view === "absen" && modelsLoaded && !isProcessing) {
      // Input size diperkecil ke 128 untuk performa maksimal (trade-off akurasi sedikit)
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
            // Toleransi jarak diperlebar agar cepat "PAS"
            if (width < 80) { 
              setJarakWajah("jauh"); 
              setPesan("Dekatkan");
            } else if (width > 300) { 
              setJarakWajah("dekat"); 
              setPesan("Jauhkan");
            } else {
              setJarakWajah("pas");
              setPesan("⚡ CAPTURE!");
              setIsProcessing(true);
              clearInterval(interval);
              handleInstantCapture();
            }
          }
        }
      }, 80); // Cek setiap 80ms (sangat responsif)
    }
    return () => clearInterval(interval);
  }, [view, modelsLoaded, isProcessing]);

  const handleInstantCapture = () => {
    // Kualitas dikurangi ke 0.3 agar file Base64 sangat kecil
    const image = webcamRef.current?.getScreenshot({ quality: 0.3 });
    if (image && coords) {
      sendToServer(image, coords.lat, coords.lng);
    }
  };

  // 3. KIRIM DATA KILAT
  const sendToServer = async (image: string, lat: number, lng: number) => {
    setPesan("🚀 Mengirim...");
    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ image, lat, lng }),
      });
      
      if (res.ok) {
        // Langsung pindah halaman tanpa menunggu popup ditutup
        router.push("/dashboard-absensi");
        Swal.fire({ title: "Berhasil!", icon: "success", timer: 1000, showConfirmButton: false });
      } else {
        throw new Error("Gagal");
      }
    } catch (e: any) {
      setIsProcessing(false);
      setJarakWajah("none");
      Swal.fire("Gagal", "Cek Koneksi", "error");
    }
  };

  const startAbsenFlow = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setView("absen");
      },
      () => Swal.fire("GPS Mati", "Aktifkan lokasi!", "error"),
      { enableHighAccuracy: false } // False agar GPS mengunci lebih cepat
    );
  };

  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik">
        <div className="w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-20 h-20 bg-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-xl mb-4">
            <span className="text-white text-3xl font-black italic">⚡</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Turbo Absen</h1>
          <p className="text-amber-800 font-bold text-[10px] tracking-widest mt-2 mb-8 italic uppercase text-opacity-50 tracking-[0.2em]">Sanpio System</p>
          <button 
            disabled={!modelsLoaded}
            onClick={startAbsenFlow} 
            className={`w-full py-4 ${modelsLoaded ? 'bg-red-600 shadow-red-200' : 'bg-slate-300'} text-white rounded-2xl font-black shadow-lg transition-all active:scale-95`}
          >
            {modelsLoaded ? "MULAI" : "MEMUAT..."}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-4 relative bg-batik overflow-hidden">
      <div className="relative w-full max-w-md aspect-[3/4] rounded-[40px] overflow-hidden border-4 border-white bg-slate-900 shadow-2xl">
        <Webcam 
          ref={webcamRef} 
          audio={false} 
          screenshotFormat="image/jpeg" 
          videoConstraints={videoConstraints} 
          className="w-full h-full object-cover" 
        />
        
        {/* Frame UI */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className={`relative w-72 h-72 border-2 rounded-full transition-all duration-300 ${jarakWajah === 'pas' ? 'border-green-400 scale-110' : 'border-white/30'}`}>
                <div className={`absolute inset-0 border-t-4 border-red-600 rounded-full animate-spin-slow ${jarakWajah === 'pas' ? 'opacity-0' : 'opacity-100'}`}></div>
            </div>
        </div>

        {/* GPS Info & Status */}
        <div className="absolute bottom-0 w-full z-30 bg-black/80 backdrop-blur-md p-6 border-t border-white/10">
            <div className="flex justify-between items-center text-white/50 text-[8px] font-mono mb-4 tracking-widest uppercase">
                <span>Lat: {coords?.lat.toFixed(5)}</span>
                <span>Lng: {coords?.lng.toFixed(5)}</span>
            </div>
            <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full bg-red-600 transition-all ${jarakWajah === "pas" ? "w-full" : "w-1/4"}`}></div>
                </div>
                <span className="text-[10px] text-white font-black uppercase italic tracking-widest">{pesan}</span>
            </div>
        </div>
      </div>

      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }
        .animate-spin-slow { animation: spin 3s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
