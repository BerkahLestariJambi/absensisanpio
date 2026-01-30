"use client";
import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

export default function HomeAbsensi() {
  const [view, setView] = useState<"menu" | "absen">("menu");
  const webcamRef = useRef<Webcam>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pesan, setPesan] = useState("Mencari Sinyal GPS...");
  const [jarakWajah, setJarakWajah] = useState<"pas" | "jauh" | "dekat" | "none">("none");
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  // Konfigurasi Lokasi
  const schoolCoords = { lat: -6.2000, lng: 106.8000 };
  const maxRadius = 50;

  useEffect(() => {
    if (view === "absen") {
      const interval = setInterval(() => {
        // Simulasi logika deteksi jarak wajah sederhana
        const randomDist = Math.random(); 
        if (randomDist > 0.8) setJarakWajah("dekat");
        else if (randomDist < 0.2) setJarakWajah("jauh");
        else setJarakWajah("pas");
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [view]);

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
          setTimeout(() => ambilFotoOtomatis(pos.coords.latitude, pos.coords.longitude), 4000);
        } else {
          setPesan("Di Luar Area Sekolah");
          Swal.fire("Akses Ditolak", "Anda berada di luar radius.", "error");
        }
      },
      () => Swal.fire("GPS Error", "Aktifkan GPS Anda!", "error"),
      { enableHighAccuracy: true }
    );
  };

  const ambilFotoOtomatis = async (lat: number, lng: number) => {
    if (webcamRef.current && !isProcessing) {
      setIsProcessing(true);
      const image = webcamRef.current.getScreenshot();
      try {
        const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image, lat, lng }),
        });
        if (res.ok) {
          Swal.fire({ title: "Berhasil!", text: "Absensi Terekam", icon: "success", timer: 1500, showConfirmButton: false });
          router.push("/admin/dashboard");
        }
      } catch (error) {
        setIsProcessing(false);
      }
    }
  };

  if (view === "menu") {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-[40px] shadow-2xl p-10 text-center border border-slate-200">
          <div className="w-20 h-20 bg-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-xl mb-4">
            <span className="text-white text-3xl font-black">S</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800">SANPIO SYSTEM</h1>
          <div className="space-y-4 mt-8">
            <button onClick={() => { setView("absen"); getInitialLocation(); }} className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-200 active:scale-95 transition-all">
              🚀 MULAI ABSENSI
            </button>
            <button onClick={() => router.push("/admin/login")} className="w-full py-4 bg-white text-slate-700 border-2 border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95">
              🔐 LOGIN ADMIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative font-sans text-white">
      <button onClick={() => setView("menu")} className="absolute top-6 left-6 z-50 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md text-xs font-bold border border-white/10">
        ← BATAL
      </button>

      <div className="relative w-full max-w-md aspect-[3/4] rounded-[30px] overflow-hidden border border-white/10 bg-slate-900 shadow-[0_0_60px_rgba(220,38,38,0.3)]">
        <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} className="w-full h-full object-cover grayscale-[0.2]" />
        
        {/* FRAME PENDETEKSI MERAH */}
        <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="relative w-72 h-72">
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-red-600 rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-red-600 rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-red-600 rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-red-600 rounded-br-xl"></div>
                
                {/* Garis Scanner Merah */}
                <div className="absolute w-full h-[3px] bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.9)] animate-scan-red"></div>
            </div>
        </div>

        {/* INSTRUKSI DINAMIS */}
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-between py-12 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 px-6 py-2 rounded-full">
            <p className="text-red-500 font-black text-sm tracking-widest animate-pulse">
              {jarakWajah === "pas" && "POSISI PAS! TAHAN..."}
              {jarakWajah === "jauh" && "DEKATKAN WAJAH ANDA"}
              {jarakWajah === "dekat" && "KAMERA TERLALU DEKAT"}
              {jarakWajah === "none" && "MASUKKAN WAJAH KE FRAME"}
            </p>
          </div>

          <div className="w-full px-10 text-center space-y-2">
            <p className="text-[10px] text-white/50 tracking-[0.3em] font-light">SYSTEM BIOMETRIC SCAN V.2</p>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-red-600 animate-loading"></div>
            </div>
            <p className="text-[9px] text-red-500/80 font-mono mt-1">{pesan}</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes scan-red {
          0% { top: 5%; opacity: 0.3; }
          50% { opacity: 1; }
          100% { top: 95%; opacity: 0.3; }
        }
        @keyframes loading {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-scan-red {
          animation: scan-red 2s infinite ease-in-out;
        }
        .animate-loading {
          animation: loading 4s linear;
        }
      `}</style>
    </div>
  );
}
