"use client";
import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

export default function HomeAbsensi() {
  const [view, setView] = useState<"menu" | "absen">("menu");
  const webcamRef = useRef<Webcam>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pesan, setPesan] = useState("Menyiapkan sistem...");
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  // Konfigurasi Radius Sekolah
  const schoolCoords = { lat: -6.2000, lng: 106.8000 };
  const maxRadius = 50; 

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
          setPesan("Wajah terdeteksi! Tahan posisi...");
          setTimeout(() => ambilFotoOtomatis(pos.coords.latitude, pos.coords.longitude), 3000);
        } else {
          setPesan(`Di luar radius! Jarak: ${Math.round(distance)}m`);
          Swal.fire("Gagal", "Anda berada di luar radius sekolah.", "error");
        }
      },
      (err) => {
        setPesan("Gagal deteksi lokasi.");
        Swal.fire("GPS Mati", "Harap aktifkan GPS Anda!", "error");
      },
      { enableHighAccuracy: true }
    );
  };

  const mulaiAbsen = () => {
    setView("absen");
    const hasPermission = localStorage.getItem("absen_permission");
    if (!hasPermission) {
      Swal.fire({
        title: "Izin Akses",
        text: "Aplikasi memerlukan izin Kamera dan GPS.",
        icon: "info",
        confirmButtonText: "Berikan Izin",
        confirmButtonColor: "#1d4ed8",
      }).then((result) => {
        if (result.isConfirmed) {
          localStorage.setItem("absen_permission", "true");
          getInitialLocation();
        }
      });
    } else {
      getInitialLocation();
    }
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
          Swal.fire({
            title: "Absensi Berhasil!",
            text: "Selamat, data Anda telah masuk.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
          });
          router.push("/admin/dashboard"); 
        }
      } catch (error) {
        setIsProcessing(false);
        setPesan("Gagal mengirim data.");
      }
    }
  };

  if (view === "menu") {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-[40px] shadow-2xl p-10 text-center border border-slate-200">
          <div className="mb-8">
            <div className="w-20 h-20 bg-blue-700 rounded-3xl mx-auto flex items-center justify-center shadow-xl mb-4">
              <span className="text-white text-3xl font-black">S</span>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">SANPIO SYSTEM</h1>
            <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest">Portal Kehadiran</p>
          </div>
          <div className="space-y-4">
            <button onClick={mulaiAbsen} className="w-full py-4 bg-blue-700 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-800 transition-all active:scale-95 flex items-center justify-center gap-3">
              🚀 MULAI ABSENSI
            </button>
            <button onClick={() => router.push("/admin/login")} className="w-full py-4 bg-white text-slate-700 border-2 border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95">
              🔐 LOGIN ADMIN
            </button>
          </div>
        </div>
        <p className="mt-8 text-slate-400 text-[10px] font-medium tracking-[0.2em]">V.2026.01</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-white">
      {/* Tombol Back */}
      <button onClick={() => setView("menu")} className="absolute top-6 left-6 z-50 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md text-sm font-bold border border-white/10 transition-all hover:bg-white/20">
        ← KEMBALI
      </button>

      {/* Area Kamera */}
      <div className="relative w-full max-w-md aspect-[3/4] rounded-[30px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 bg-slate-900">
        <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} className="w-full h-full object-cover grayscale-[0.3]" />
        
        {/* FRAME PENDETEKSI (KOTAK SUDUT) */}
        <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="relative w-64 h-64">
                {/* Corner Top Left */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                {/* Corner Top Right */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                {/* Corner Bottom Left */}
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                {/* Corner Bottom Right */}
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                
                {/* Efek Scanning Line (Hanya didalam kotak) */}
                <div className="absolute w-full h-[2px] bg-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan-inner"></div>
            </div>
        </div>

        {/* Info Label Overlay */}
        <div className="absolute bottom-10 left-0 w-full z-40 text-center space-y-3">
          <div className="inline-block px-4 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-full backdrop-blur-md">
            <p className="text-blue-400 font-bold text-xs tracking-widest uppercase animate-pulse">
              {pesan}
            </p>
          </div>
          
          {coords && (
            <div className="flex flex-col items-center opacity-60">
                <p className="text-[10px] font-mono tracking-tighter">LOC: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
                <div className="w-24 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-blue-500 animate-loading-strip"></div>
                </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes scan-inner {
          0% { top: 0%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes loading-strip {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-scan-inner {
          animation: scan-inner 2.5s infinite linear;
        }
        .animate-loading-strip {
          animation: loading-strip 3s infinite linear;
        }
      `}</style>
    </div>
  );
}
