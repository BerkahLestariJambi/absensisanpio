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
  const [pesan, setPesan] = useState("Memuat Sistem...");
  const [jarakWajah, setJarakWajah] = useState<"pas" | "jauh" | "dekat" | "none">("none");
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const router = useRouter();

  const videoConstraints = { width: 320, height: 480, facingMode: "user" as const };

  // --- 1. LOAD AI, DATABASE WAJAH, & GPS LOCK ---
  useEffect(() => {
    const initSistem = async () => {
      try {
        const MODEL_URL = "/models";
        // Load semua engine AI
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        // Ambil data guru dari API untuk referensi wajah
        const res = await fetch("https://backendabsen.mejatika.com/api/gurus");
        const gurus = await res.json();

        const labeledDescriptors = await Promise.all(
          gurus.map(async (guru: any) => {
            if (!guru.foto_profil) return null;
            // Fetch foto asli guru untuk dipelajari AI
            const img = await faceapi.fetchImage(`https://backendabsen.mejatika.com/storage/${guru.foto_profil}`);
            const fullDesc = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            return fullDesc ? new faceapi.LabeledFaceDescriptors(guru.id.toString(), [fullDesc.descriptor]) : null;
          })
        );

        const validDescriptors = labeledDescriptors.filter(d => d !== null) as faceapi.LabeledFaceDescriptors[];
        if (validDescriptors.length > 0) {
          setFaceMatcher(new faceapi.FaceMatcher(validDescriptors, 0.6));
          setPesan("⚡ Sistem Siap");
        } else {
          setPesan("Database Wajah Kosong");
        }
      } catch (err) {
        console.error(err);
        setPesan("Gagal Inisialisasi");
      }
    };

    initSistem();

    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        null,
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // --- 2. LOGIKA RECOGNITION & AUTO SUBMIT ---
  useEffect(() => {
    let interval: any;
    if (view === "absen" && faceMatcher && !isProcessing) {
      interval = setInterval(async () => {
        if (webcamRef.current?.video?.readyState === 4) {
          const video = webcamRef.current.video;
          // Deteksi Wajah + Landmark + Descriptor (untuk Recognition)
          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!detection) {
            setJarakWajah("none");
            setPesan("Mencari Wajah...");
          } else {
            const { width } = detection.detection.box;
            
            // Validasi Jarak Wajah
            if (width < 90) { setJarakWajah("jauh"); setPesan("Dekatkan Wajah"); }
            else if (width > 260) { setJarakWajah("dekat"); setPesan("Terlalu Dekat"); }
            else {
              // COCOKKAN WAJAH DENGAN DATABASE
              const match = faceMatcher.findBestMatch(detection.descriptor);
              
              if (match.label === "unknown") {
                setJarakWajah("none");
                setPesan("Wajah Tak Dikenal");
              } else {
                setJarakWajah("pas");
                setPesan(`Halo! Mengirim Data...`);
                
                if (coords) {
                  setIsProcessing(true);
                  clearInterval(interval);
                  sendToServer(match.label, coords.lat, coords.lng);
                }
              }
            }
          }
        }
      }, 400); // Speed optimal agar tidak lag
    }
    return () => clearInterval(interval);
  }, [view, faceMatcher, isProcessing, coords]);

  const sendToServer = async (guruId: string, lat: number, lng: number) => {
    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guru_id: guruId, lat, lng }),
      });
      if (res.ok) {
        Swal.fire({ title: "Berhasil!", text: "Wajah Dikenali & Absen Tercatat.", icon: "success", timer: 2000, showConfirmButton: false });
        router.push("/dashboard-absensi");
      }
    } catch (e) {
      setIsProcessing(false);
      Swal.fire("Gagal", "Masalah Koneksi", "error");
    }
  };

  // --- UI MENU UTAMA ---
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik">
        <div className="w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-16 h-16 bg-red-600 rounded-2xl mx-auto flex items-center justify-center shadow-xl mb-4 text-white text-3xl font-black italic">⚡</div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase mb-6">Turbo Recognition</h1>
          
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mb-8">
            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">Status Sistem:</p>
            <p className={`text-[12px] font-mono font-bold ${faceMatcher && coords ? "text-green-600" : "text-red-500 animate-pulse"}`}>
              {pesan}
            </p>
          </div>
          
          <button 
            disabled={!faceMatcher || !coords}
            onClick={() => setView("absen")} 
            className={`w-full py-4 ${faceMatcher && coords ? 'bg-red-600 hover:scale-105 shadow-lg' : 'bg-slate-300'} text-white rounded-2xl font-black transition-all`}
          >
            {faceMatcher ? "🚀 MULAI SCAN WAJAH" : "MENYIAPKAN AI..."}
          </button>
          <button onClick={() => router.push("/admin/login")} className="mt-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">🔐 Admin Login</button>
        </div>
      </div>
    );
  }

  // --- UI KAMERA (LAYOUT ATAS + SCANNER + INFO GPS) ---
  return (
    <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center p-4 relative bg-batik overflow-hidden">
      <div className="w-full max-w-md flex justify-start mt-2 mb-2">
        <button onClick={() => { setView("menu"); setIsProcessing(false); }} className="bg-red-600 px-4 py-2 rounded-xl text-white text-[10px] font-black z-50 shadow-lg">← BATAL</button>
      </div>

      <div className="relative w-full max-w-md aspect-[3/4] rounded-[40px] overflow-hidden border-4 border-white bg-slate-900 shadow-2xl mb-6">
        <Webcam ref={webcamRef} audio={false} videoConstraints={videoConstraints} className="w-full h-full object-cover" />
        
        {/* Fitur: Garis Scanner Laser */}
        <div className={`absolute left-0 w-full h-[2px] bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] z-20 animate-scan ${jarakWajah === 'pas' ? 'hidden' : ''}`}></div>

        {/* Fitur: Info Overlay (Lat, Lng & Progress Bar) */}
        <div className="absolute bottom-0 w-full z-30 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-10 pb-6 px-6">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4">
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
        <p className="text-slate-800 font-black text-[10px] tracking-[0.3em] uppercase italic leading-none">Sanpio Auto-Recognition</p>
      </div>

      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }
        .animate-scan { animation: scan 2s linear infinite; }
        @keyframes scan { 0% { top: 0%; } 100% { top: 100%; } }
      `}</style>
    </div>
  );
}
