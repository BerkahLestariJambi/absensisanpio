"use client";
import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";

export default function AbsensiSanpio() {
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState("Klik tombol di bawah untuk mulai");

  // 1. Fungsi Ambil Lokasi (Koordinat)
  const ambilLokasi = () => {
    setLoading(true);
    setPesan("Sedang mengunci koordinat GPS...");
    
    if (!navigator.geolocation) {
      alert("Browser kamu tidak mendukung GPS");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPesan("Lokasi terkunci! Sekarang silakan scan wajah.");
        setLoading(false);
      },
      (err) => {
        alert("Gagal ambil lokasi. Pastikan GPS HP nyala.");
        setLoading(false);
      }
    );
  };

  // 2. Fungsi Ambil Foto (Scan Wajah)
  const ambilFoto = () => {
    if (webcamRef.current) {
      const image = webcamRef.current.getScreenshot();
      setImgSrc(image);
      setPesan("Absensi Berhasil! Data tersimpan lokal.");
      
      // Simulasi simpan ke memori HP
      const dataAbsen = {
        waktu: new Date().toISOString(),
        lokasi: coords,
        foto: image
      };
      console.log("Data Absen:", dataAbsen);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-700 p-6 text-white text-center">
          <h1 className="text-xl font-bold tracking-tight">ABSENSI SANPIO</h1>
          <p className="text-xs opacity-80 uppercase mt-1">Next.js Mobile Tracker</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Layar Kamera / Preview Foto */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border-4 border-gray-100 shadow-inner">
            {!imgSrc ? (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover"
                videoConstraints={{ facingMode: "user" }}
              />
            ) : (
              <img src={imgSrc} className="w-full h-full object-cover" alt="Hasil Scan" />
            )}
          </div>

          {/* Info Status & Koordinat */}
          <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
            <p className="text-xs text-slate-500 font-bold uppercase">Status:</p>
            <p className="text-sm text-slate-700 mt-1 italic">{pesan}</p>
            {coords && (
              <div className="mt-2 text-[10px] text-blue-600 font-mono">
                Lat: {coords.lat} | Lng: {coords.lng}
              </div>
            )}
          </div>

          {/* Tombol Aksi */}
          <div className="space-y-3">
            {!coords ? (
              <button
                onClick={ambilLokasi}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-lg disabled:bg-gray-400"
              >
                {loading ? "MENCARI GPS..." : "1. CEK LOKASI"}
              </button>
            ) : !imgSrc ? (
              <button
                onClick={ambilFoto}
                className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-lg animate-pulse"
              >
                2. SCAN WAJAH (ABSEN)
              </button>
            ) : (
              <button
                onClick={() => { setImgSrc(null); setCoords(null); setPesan("Siap Absen Kembali"); }}
                className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold"
              >
                RESET / ABSEN ULANG
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-gray-400 text-[10px]">© 2026 Informatika XI - Mejatika Project</p>
    </div>
  );
}
