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
  const [pesan, setPesan] = useState("Menyiapkan...");
  const [jarakWajah, setJarakWajah] = useState<"pas" | "jauh" | "dekat" | "none">("none");
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const router = useRouter();

  // 1. LOAD MODEL DETEKSI (Sangat Ringan & Cepat)
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
        setPesan("Sistem Siap");
      } catch (err) {
        console.error("AI Error:", err);
        setPesan("Gagal Load AI");
      }
    };
    loadModels();
  }, []);

  // 2. LOGIKA OTOMATIS: DETEKSI POSISI -> LANGSUNG CAPTURE
  useEffect(() => {
    let interval: any;
    if (view === "absen" && modelsLoaded && !isProcessing) {
      const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 128 });

      interval = setInterval(async () => {
        if (webcamRef.current?.video?.readyState === 4) {
          const video = webcamRef.current.video;
          const detection = await faceapi.detectSingleFace(video, detectorOptions);

          if (!detection) {
            setJarakWajah("none");
            setPesan("Mencari Wajah...");
          } else {
            const { width } = detection.box;
            
            if (width < 100) {
              setJarakWajah("jauh");
              setPesan("Dekatkan Wajah");
            } else if (width > 280) {
              setJarakWajah("dekat");
              setPesan("Terlalu Dekat");
            } else {
              // POSISI PAS! LANGSUNG EKSEKUSI
              setJarakWajah("pas");
              setPesan("Mengambil Foto...");
              setIsProcessing(true);
              clearInterval(interval);
              
              // Delay sedikit agar user tahu posisi sudah pas
              setTimeout(() => {
                handleInstantCapture();
              }, 400);
            }
          }
        }
      }, 100); 
    }
    return () => clearInterval(interval);
  }, [view, modelsLoaded, isProcessing, coords]);

  const handleInstantCapture = () => {
    const image = webcamRef.current?.getScreenshot();
    if (image && coords) {
      sendToServer(image, coords.lat, coords.lng);
    } else {
      setIsProcessing(false);
      setPesan("Gagal Capture");
    }
  };

  // 3. KIRIM KE SERVER (BACKEND)
  const sendToServer = async (image: string, lat: number, lng: number) => {
    setPesan("Mengirim Data...");
    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json" 
        },
        body: JSON.stringify({ image, lat, lng }),
      });
      
      const data = await res.json();
      if (res.ok) {
        await Swal.fire({ 
          title: "Berhasil!", 
          text: "Absensi Anda telah terkirim.", 
          icon: "success", 
          timer: 1500, 
          showConfirmButton: false 
        });
        router.push("/dashboard-absensi"); 
      } else {
        throw new Error(data.message || "Gagal simpan di server");
      }
    } catch (e: any) {
      setIsProcessing(false);
      setJarakWajah("none");
      Swal.fire("Gagal Simpan", e.message, "error");
    }
  };

  const startAbsenFlow = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setView("absen");
      },
      () => Swal.fire("GPS Mati", "Aktifkan lokasi untuk melanjutkan!", "error"),
      { enableHighAccuracy: true }
    );
  };

  // --- TAMPILAN DASHBOARD AWAL ---
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik">
        <div className="w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-20 h-20 bg-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-xl mb-4">
            <span className="text-white text-3xl font-black">S</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Sanpio System</h1>
          <p className="text-amber-800 font-bold text-[10px] tracking-widest mt-1 mb-8 italic">INSTANT CAPTURE</p>
          <div className="space-y-4">
            <button 
              disabled={!modelsLoaded}
              onClick={startAbsenFlow} 
              className={`w-full py-4 ${modelsLoaded ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-300'} text-white rounded-2xl font-bold shadow-lg transition-all active:scale-95`}
            >
              {modelsLoaded ? "🚀 MULAI ABSEN" : "MEMUAT AI..."}
            </button>
            <button onClick={() => router.push("/admin/login")} className="w-full py-4 bg-white text-slate-700 border-2 border-amber-100 rounded-2xl font-bold hover:bg-amber-50 transition-all active:scale-95">
              🔐 LOGIN ADMIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- TAMPILAN KAMERA ABSENSI ---
  return (
    <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-4 relative bg-batik overflow-hidden">
      <button 
        onClick={() => { setView("menu"); setIsProcessing(false); }} 
        className="absolute top-6 left-6 z-50 bg-red-600 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-lg active:scale-90"
      >
        ← BATAL
      </button>

      <div className="relative w-full max-w-md aspect-[3/4] rounded-[40px] overflow-hidden border-4 border-white bg-slate-900 shadow-2xl">
        <Webcam 
          ref={webcamRef} 
          audio={false} 
          screenshotFormat="image/jpeg" 
          screenshotQuality={0.5} 
          videoConstraints={{ facingMode: "user" }} 
          className="w-full h-full object-cover" 
        />
        
        {/* Frame Scanner Visual */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className={`relative w-72 h-72 transition-all duration-500 ${jarakWajah === 'pas' ? 'scale-105' : 'scale-100'}`}>
                <div className={`absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 rounded-tl-xl ${jarakWajah === 'pas' ? 'border-green-500' : 'border-red-600'}`}></div>
                <div className={`absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 rounded-tr-xl ${jarakWajah === 'pas' ? 'border-green-500' : 'border-red-600'}`}></div>
                <div className={`absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 rounded-bl-xl ${jarakWajah === 'pas' ? 'border-green-500' : 'border-red-600'}`}></div>
                <div className={`absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 rounded-br-xl ${jarakWajah === 'pas' ? 'border-green-500' : 'border-red-600'}`}></div>
                <div className={`absolute w-full h-[2px] animate-scan-red ${jarakWajah === 'pas' ? 'bg-green-400' : 'bg-red-500'}`}></div>
            </div>
        </div>

        {/* INFO KOORDINAT GPS (BAGIAN BAWAH FRAME) */}
        <div className="absolute bottom-0 w-full z-30 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-10 pb-6 px-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-4 shadow-2xl">
                <div className="flex justify-between items-center mb-3">
                    <div className="space-y-1">
                        <p className="text-[9px] text-red-400 font-bold uppercase tracking-widest">Latitude</p>
                        <p className="text-sm font-mono text-white font-bold leading-none">
                            {coords ? coords.lat.toFixed(7) : "Mencari..."}
                        </p>
                    </div>
                    <div className="w-[1px] h-8 bg-white/20"></div>
                    <div className="space-y-1 text-right">
                        <p className="text-[9px] text-red-400 font-bold uppercase tracking-widest">Longitude</p>
                        <p className="text-sm font-mono text-white font-bold leading-none">
                            {coords ? coords.lng.toFixed(7) : "Mencari..."}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 border-t border-white/10 pt-3">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-red-600 transition-all duration-700 
                          ${jarakWajah === "pas" ? "w-full" : "w-1/3"}`}
                        ></div>
                    </div>
                    <span className="text-[10px] text-amber-200 font-black uppercase italic tracking-tighter whitespace-nowrap">
                      {pesan}
                    </span>
                </div>
            </div>
        </div>
      </div>

      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }
        @keyframes scan-red { 0% { top: 5%; opacity: 0.2; } 50% { opacity: 1; } 100% { top: 95%; opacity: 0.2; } }
        .animate-scan-red { position: absolute; width: 100%; animation: scan-red 2.5s infinite ease-in-out; }
      `}</style>
    </div>
  );
}
