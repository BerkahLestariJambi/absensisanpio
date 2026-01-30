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
  
  // FITUR BARU: State untuk menampung Guru ID
  const [selectedGuruId, setSelectedGuruId] = useState<string>("");
  const [listGuru, setListGuru] = useState<any[]>([]);

  const router = useRouter();

  const videoConstraints = {
    width: 320,
    height: 480,
    facingMode: "user" as const,
  };

  // 1. AUTO LOCK GPS, LOAD MODELS & FETCH GURU
  useEffect(() => {
    const initSistem = async () => {
      try {
        const MODEL_URL = "/models";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        setModelsLoaded(true);

        // Ambil data guru untuk pilihan di menu
        const res = await fetch("https://backendabsen.mejatika.com/api/gurus");
        const data = await res.json();
        setListGuru(data);
      } catch (err) {
        setPesan("Gagal Load AI/Data");
      }
    };
    initSistem();

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
              
              if (coords && selectedGuruId) {
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
  }, [view, modelsLoaded, isProcessing, coords, selectedGuruId]);

  // 3. KIRIM DATA DENGAN GURU_ID
  const sendToServer = async (lat: number, lng: number) => {
    setPesan("🚀 Mengirim...");
    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ 
          lat, 
          lng, 
          guru_id: selectedGuruId // Sekarang mengirim ID asli
        }),
      });
      
      const responseData = await res.json().catch(() => ({}));

      if (res.ok) {
        Swal.fire({ title: "Berhasil!", text: "Absen berhasil dicatat.", icon: "success", timer: 1500, showConfirmButton: false });
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

  // --- UI MENU UTAMA ---
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik text-slate-800">
        <div className="w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-16 h-16 bg-red-600 rounded-2xl mx-auto flex items-center justify-center shadow-xl mb-4">
            <span className="text-white text-3xl font-black italic">⚡</span>
          </div>
          <h1 className="text-2xl font-black tracking-tighter uppercase leading-none mb-6">Turbo Absen</h1>
          
          <div className="space-y-4">
            {/* Input Pilih Nama Guru */}
            <div className="text-left">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Pilih Nama Anda:</label>
              <select 
                value={selectedGuruId}
                onChange={(e) => setSelectedGuruId(e.target.value)}
                className="w-full mt-1 p-3 bg-white border-2 border-amber-100 rounded-2xl text-sm font-bold focus:outline-none focus:border-red-500 transition-all"
              >
                <option value="">-- Pilih Nama Guru --</option>
                {listGuru.map((g) => (
                  <option key={g.id} value={g.id}>{g.nama_lengkap}</option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
              <p className="text-[9px] font-bold text-amber-800 uppercase tracking-widest">GPS Status:</p>
              <p className={`text-[11px] font-mono font-bold ${coords ? "text-green-600" : "text-red-500 animate-pulse"}`}>
                {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "MENCARI SATELIT..."}
              </p>
            </div>
            
            <button 
              disabled={!modelsLoaded || !coords || !selectedGuruId}
              onClick={() => setView("absen")} 
              className={`w-full py-4 ${modelsLoaded && coords && selectedGuruId ? 'bg-red-600 hover:scale-105 active:scale-95' : 'bg-slate-300'} text-white rounded-2xl font-black shadow-lg transition-all`}
            >
              {selectedGuruId ? "🚀 MULAI ABSEN" : "PILIH NAMA DULU"}
            </button>
            <button onClick={() => router.push("/admin/login")} className="text-[11px] font-bold text-slate-400 hover:text-red-600 transition-colors mt-4">🔐 LOGIN ADMIN</button>
          </div>
        </div>
      </div>
    );
  }

  // --- UI KAMERA ABSEN ---
  return (
    <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center p-4 relative bg-batik overflow-hidden">
      <div className="w-full max-w-md flex justify-start mt-2 mb-2">
        <button onClick={() => { setView("menu"); setIsProcessing(false); }} className="bg-red-600 px-4 py-2 rounded-xl text-white text-[10px] font-black shadow-lg">← BATAL</button>
      </div>

      <div className="relative w-full max-w-md aspect-[3/4] rounded-[40px] overflow-hidden border-4 border-white bg-slate-900 shadow-2xl mb-6">
        <Webcam ref={webcamRef} audio={false} videoConstraints={videoConstraints} className="w-full h-full object-cover" />
        
        {/* Fitur: Garis Scanner Laser */}
        <div className={`absolute left-0 w-full h-[2px] bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] z-20 animate-scan ${jarakWajah === 'pas' ? 'hidden' : ''}`}></div>

        {/* Fitur: Info Overlay (Lat, Lng & Progress Bar) */}
        <div className="absolute bottom-0 w-full z-30 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-10 pb-6 px-6">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 shadow-2xl">
                <div className="flex justify-between items-center mb-3">
                    <div className="space-y-1">
                        <p className="text-[8px] text-red-400 font-bold uppercase tracking-widest leading-none">Latitude</p>
                        <p className="text-[12px] font-mono text-white font-bold leading-none">{coords ? coords.lat.toFixed(7) : "Searching..."}</p>
                    </div>
                    <div className="w-[1px] h-6 bg-white/20"></div>
                    <div className="space-y-1 text-right">
                        <p className="text-[8px] text-red-400 font-bold uppercase tracking-widest leading-none">Longitude</p>
                        <p className="text-[12px] font-mono text-white font-bold leading-none">{coords ? coords.lng.toFixed(7) : "Searching..."}</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 border-t border-white/10 pt-3">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full bg-red-600 transition-all duration-700 ${jarakWajah === "pas" ? "w-full" : "w-1/3"}`}></div>
                    </div>
                    <span className="text-[9px] text-amber-200 font-black uppercase italic tracking-widest">{pesan}</span>
                </div>
            </div>
        </div>
      </div>

      <div className="w-full max-w-md px-6 text-center opacity-40 mt-2">
        <p className="text-slate-800 font-black text-[10px] tracking-[0.3em] uppercase italic leading-none">Sanpio Turbo Absen</p>
      </div>

      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }
        .animate-scan { animation: scan 2s linear infinite; }
        @keyframes scan { 0% { top: 0%; } 100% { top: 100%; } }
      `}</style>
    </div>
  );
}
