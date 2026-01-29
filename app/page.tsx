"use client";
import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import Swal from "sweetalert2";

export default function AbsensiSanpio() {
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pesan, setPesan] = useState("Menyiapkan sistem...");

  useEffect(() => {
    // Fungsi untuk meminta lokasi
    const getInitialLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setPesan("Lokasi terkunci! Silakan scan wajah.");
        },
        (err) => {
          setPesan("Gagal deteksi lokasi. Pastikan GPS aktif.");
        }
      );
    };

    // Cek apakah sudah pernah minta izin sebelumnya di browser ini
    const hasPermission = localStorage.getItem("absen_permission");

    if (!hasPermission) {
      // Munculkan Sweet Alert jika pertama kali buka
      Swal.fire({
        title: "Izin Akses",
        text: "Aplikasi Absensi Sanpio memerlukan izin Kamera dan Lokasi (GPS) untuk berfungsi.",
        icon: "info",
        confirmButtonText: "Berikan Izin",
        confirmButtonColor: "#1d4ed8",
        allowOutsideClick: false,
      }).then((result) => {
        if (result.isConfirmed) {
          localStorage.setItem("absen_permission", "true");
          getInitialLocation();
        }
      });
    } else {
      // Jika sudah pernah izin, langsung ambil lokasi tanpa Sweet Alert
      getInitialLocation();
    }
  }, []);

  const ambilFoto = () => {
    if (webcamRef.current) {
      const image = webcamRef.current.getScreenshot();
      setImgSrc(image);
      
      // Sweet Alert Sukses Absen
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-4">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-8 text-white text-center">
          <h1 className="text-2xl font-black tracking-widest uppercase">Sanpio Absen</h1>
          <p className="text-[10px] opacity-70 mt-1 uppercase tracking-widest">Sistem Absensi Digital</p>
        </div>

        <div className="p-8 flex flex-col items-center space-y-6">
          
          {/* KAMERA LONJONG */}
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

          {/* Info Status */}
          <div className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
            <span className="text-[10px] font-bold text-blue-600 uppercase block mb-1">Status Kehadiran</span>
            <p className="text-sm text-slate-600 font-medium leading-relaxed">{pesan}</p>
            {coords && (
              <div className="mt-2 inline-block px-3 py-1 bg-blue-100 rounded-full text-[9px] text-blue-700 font-mono">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </div>
            )}
          </div>

          {/* Tombol Aksi */}
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
                {coords ? "SCAN WAJAH" : "MENGUNCI GPS..."}
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

      <p className="mt-8 text-slate-400 text-[10px] font-medium tracking-[0.2em]">SANPIO DIGITAL SYSTEM 2026</p>
    </div>
  );
}
