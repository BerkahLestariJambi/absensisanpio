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

  // Konfigurasi Radius Sekolah (Contoh: -6.2000, 106.8000)
  const schoolCoords = { lat: -6.2000, lng: 106.8000 };
  const maxRadius = 50; // dalam meter

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
          // Auto capture setelah 3 detik jika posisi benar
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
            text: "Data Anda telah terekam di sistem.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
          });
          router.push("/admin/dashboard"); // Arahkan ke log/dashboard
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <button onClick={() => setView("menu")} className="absolute top-6 left-6 z-50 bg-white/10 text-white px-4 py-2 rounded-xl backdrop-blur-md text-sm font-bold border border-white/10">
        ← KEMBALI
      </button>

      <div className="relative w-full max-w-md aspect-[3/4] rounded-[40px] overflow-hidden shadow-2xl border-4 border-slate-800 bg-black">
        <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} className="w-full h-full object-cover" />
        
        {/* Frame Oval Pembatas Wajah */}
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="w-[260px] h-[340px] border-2 border-dashed border-blue-400/50 rounded-[120px] shadow-[0_0_0_1000px_rgba(15,23,42,0.7)]"></div>
          <div className="absolute w-[280px] h-[360px] border border-blue-500/20 rounded-[130px]"></div>
        </div>

        {/* Efek Animasi Laser Scan */}
        <div className="absolute left-0 w-full h-[3px] bg-blue-500 shadow-[0_0_15px_3px_rgba(59,130,246,0.8)] z-30 animate-scan"></div>

        {/* Info Overlay */}
        <div className="absolute bottom-0 left-0 w-full p-8 z-40 bg-gradient-to-t from-slate-950 to-transparent">
          <div className="text-center space-y-2">
            <p className="text-blue-400 font-black text-lg tracking-wider animate-pulse uppercase">
              {pesan}
            </p>
            {coords && (
              <div className="text-[10px] text-slate-400 font-mono">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes scan {
          0% { top: 20%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 80%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 3s infinite linear;
        }
      `}</style>
    </div>
  );
}
