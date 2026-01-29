"use client";
import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation"; // Jika pakai App Router Next.js

export default function HomeAbsensi() {
  const [view, setView] = useState<"menu" | "absen">("menu"); // State untuk ganti tampilan
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pesan, setPesan] = useState("Menyiapkan sistem...");
  const router = useRouter();

  // Fungsi ambil lokasi (dipindahkan agar bisa dipanggil saat tombol absen diklik)
  const getInitialLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPesan("Lokasi terkunci! Silakan scan wajah.");
      },
      (err) => {
        setPesan("Gagal deteksi lokasi. Pastikan GPS aktif.");
        Swal.fire("GPS Mati", "Harap aktifkan GPS Anda!", "error");
      }
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

  const ambilFoto = () => {
    if (webcamRef.current) {
      const image = webcamRef.current.getScreenshot();
      setImgSrc(image);
      
      Swal.fire({
        title: "Berhasil!",
        text: "Data absensi dan lokasi Anda telah terekam.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false
      });
      
      setPesan("Absensi Berhasil Terkirim!");
    }
  };

  // --- TAMPILAN MENU UTAMA ---
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
            <button
              onClick={mulaiAbsen}
              className="w-full py-4 bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-800 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              🚀 MULAI ABSENSI
            </button>

            <button
              onClick={() => router.push("/admin/login")} // Arahkan ke folder admin/login
              className="w-full py-4 bg-white text-slate-700 border-2 border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              🔐 LOGIN ADMIN
            </button>
          </div>
        </div>
        <p className="mt-8 text-slate-400 text-[10px] font-medium tracking-[0.2em]">V.2026.01</p>
      </div>
    );
  }

  // --- TAMPILAN KAMERA ABSEN ---
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-4">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-8 text-white text-center relative">
          <button 
            onClick={() => setView("menu")} 
            className="absolute left-6 top-9 text-white opacity-70 hover:opacity-100"
          >
            ←
          </button>
          <h1 className="text-2xl font-black tracking-widest uppercase">Sanpio Absen</h1>
          <p className="text-[10px] opacity-70 mt-1 uppercase tracking-widest">Scanning Phase</p>
        </div>

        <div className="p-8 flex flex-col items-center space-y-6">
          <div className="relative w-64 h-80 rounded-[120px] overflow-hidden border-8 border-slate-50 shadow-2xl bg-black transform transition-all hover:scale-105">
            {!imgSrc ? (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover scale-125"
                videoConstraints={{ facingMode: "user" }}
              />
            ) : (
              <img src={imgSrc} className="w-full h-full object-cover" alt="Hasil Scan" />
            )}
          </div>

          <div className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
            <span className="text-[10px] font-bold text-blue-600 uppercase block mb-1">Status Kehadiran</span>
            <p className="text-sm text-slate-600 font-medium leading-relaxed">{pesan}</p>
            {coords && (
              <div className="mt-2 inline-block px-3 py-1 bg-blue-100 rounded-full text-[9px] text-blue-700 font-mono">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </div>
            )}
          </div>

          <div className="w-full pt-2">
            {!imgSrc ? (
              <button
                onClick={ambilFoto}
                disabled={!coords}
                className={`w-full py-4 rounded-2xl font-bold transition-all shadow-lg ${
                  coords 
                  ? "bg-indigo-600 text-white active:scale-95 shadow-indigo-200" 
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                {coords ? "SCAN WAJAH SEKARANG" : "MENGUNCI GPS..."}
              </button>
            ) : (
              <button
                onClick={() => { setImgSrc(null); setPesan("Silakan absen kembali."); }}
                className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-slate-300"
              >
                ABSEN ULANG
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
