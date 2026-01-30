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

  // 1. LOAD MODEL AI
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
      } catch (err) {
        setPesan("Gagal Load AI");
        console.error("AI Load Error:", err);
      }
    };
    loadModels();
  }, []);

  // 2. GPS WATCH agar selalu update
  useEffect(() => {
    if (view === "absen") {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("GPS Error:", err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [view]);

  // 3. DETEKSI WAJAH + CAPTURE
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
              setPesan("⚡ CAPTURE!");
              setIsProcessing(true);
              clearInterval(interval);
              
              const image = webcamRef.current?.getScreenshot();
              
              // Kirim langsung tanpa validasi koordinat
              if (image) {
                sendToServer(image, coords?.lat || 0, coords?.lng || 0);
              } else {
                setIsProcessing(false);
                setPesan("Gagal ambil gambar.");
              }
            }
          }
        }
      }, 100); 
    }
    return () => clearInterval(interval);
  }, [view, modelsLoaded, isProcessing, coords]);

  // 4. KIRIM DATA KE BACKEND
  const sendToServer = async (image: string, lat: number, lng: number) => {
    setPesan("🚀 Mengirim...");
    try {
      const base64Image = image.split(",")[1]; // buang prefix data:image/jpeg;base64,

      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json" 
        },
        body: JSON.stringify({ image: base64Image, lat, lng }),
      });

      let responseData;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await res.json();
      } else {
        responseData = await res.text();
      }

      if (res.ok) {
        Swal.fire({ title: "Berhasil!", text: "Absensi Anda telah tercatat.", icon: "success", timer: 1500, showConfirmButton: false });
        router.push("/dashboard-absensi");
      } else {
        throw new Error(responseData.message || `Server Error: ${res.status}`);
      }
    } catch (e: any) {
      setIsProcessing(false);
      setJarakWajah("none");
      const errorMsg = e.message === "Failed to fetch" 
        ? "Gagal terhubung ke server. Periksa internet atau SSL domain." 
        : e.message;
      Swal.fire("Gagal Kirim", errorMsg, "error");
      setPesan("Gagal Kirim");
    }
  };

  // 5. FLOW MULAI (GPS lock dulu)
  const startAbsenFlow = () => {
    setPesan("🛰️ Mencari Satelit...");
    if (!navigator.geolocation) {
      return Swal.fire("Error", "Browser tidak mendukung lokasi.", "error");
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // langsung simpan koordinat apa pun hasilnya
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setView("absen");
      },
      (err) => {
        let msg = "Aktifkan GPS!";
        if (err.code === 1) msg = "Izin lokasi ditolak!";
        if (err.code === 3) msg = "Waktu pencarian GPS habis!";
        Swal.fire("GPS Error", msg, "error");
        // tetap lanjut ke kamera meskipun error
        setCoords({ lat: 0, lng: 0 });
        setView("absen");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // --- UI MENU ---
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik">
        <div className="w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-20 h-20 bg-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-xl mb-4">
            <span className="text-white text-3xl font-black italic">⚡</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Turbo Absen</h1>
          <p className="text-amber-800 font-bold text-[10px] tracking-widest mt-2 mb-8 italic uppercase opacity-50">Sanpio System</p>
          
          <div className="space-y-4">
            <button 
              disabled={!modelsLoaded}
              onClick={startAbsenFlow} 
              className={`w-full py-4 ${modelsLoaded ? 'bg-red-600 hover:bg-red-700 active:scale-95 shadow-red-200' : 'bg-slate-300'} text-white rounded-2xl font-black shadow-lg transition-all`}
            >
              {modelsLoaded ? "🚀 MULAI ABSEN" : "MEMUAT AI..."}
            </button>

            <button 
              onClick={() => router.push("/admin/login")} 
              className="w-full py-4 bg-white text-slate-700 border-2 border-amber-100 rounded-2xl font-bold hover:bg-amber-50 transition-all active:scale-95"
            >
              🔐 LOGIN ADMIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- UI KAMERA ABSENSI ---
  return (
    <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-4 relative bg-batik overflow-hidden">
      <button 
        onClick={() => { setView("menu"); setIsProcessing(false); }} 
        className="absolute top-6 left-6 z-50 bg-red-600 px-4 py-2 rounded-xl text-white text-[10px] font-black shadow-lg hover:bg-red-700 transition-colors"
      >
        ← BATAL
      </button>

            <div className="relative w-full max-w-md aspect-[3/4] rounded-[40px] overflow-hidden border-4 border-white bg-slate-900 shadow-2xl">
        <Webcam 
          ref={webcamRef} 
          audio={false} 
          screenshotFormat="image/jpeg" 
          screenshotQuality={0.5} 
          videoConstraints={videoConstraints} 
          className="w-full h-full object-cover" 
        />
        
        {/* Scanner Overlay */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className={`relative w-64 h-64 border-2 rounded-full transition-all duration-300 
            ${jarakWajah === 'pas' ? 'border-green-400 scale-110 shadow-[0_0_20px_rgba(74,222,128,0.5)]' : 'border-white/20'}`}>
            <div className={`absolute inset-0 border-t-4 border-red-600 rounded-full animate-spin-slow 
              ${jarakWajah === 'pas' ? 'opacity-0' : 'opacity-100'}`}></div>
          </div>
        </div>

        {/* Info Layer */}
        <div className="absolute bottom-0 w-full z-30 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-10 pb-6 px-6">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <div className="space-y-1">
                <p className="text-[8px] text-red-400 font-bold uppercase tracking-widest">Latitude</p>
                <p className="text-[12px] font-mono text-white font-bold">
                  {coords ? coords.lat.toFixed(7) : "Searching..."}
                </p>
              </div>
              <div className="w-[1px] h-6 bg-white/20"></div>
              <div className="space-y-1 text-right">
                <p className="text-[8px] text-red-400 font-bold uppercase tracking-widest">Longitude</p>
                <p className="text-[12px] font-mono text-white font-bold">
                  {coords ? coords.lng.toFixed(7) : "Searching..."}
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
              <span className="text-[9px] text-amber-200 font-black uppercase italic tracking-widest">
                {pesan}
              </span>
            </div>
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
