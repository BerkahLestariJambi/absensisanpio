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
  const [pesan, setPesan] = useState("Menyiapkan Sistem...");
  const [jarakWajah, setJarakWajah] = useState<"pas" | "jauh" | "dekat" | "none">("none");
  const [isProcessing, setIsProcessing] = useState(false); 
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const router = useRouter();

  const videoConstraints = { width: 320, height: 480, facingMode: "user" as const };

  // --- 1. LOAD AI & DATABASE ---
  useEffect(() => {
    const loadSistem = async () => {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        const res = await fetch("https://backendabsen.mejatika.com/api/admin/guru/referensi");
        const gurus = await res.json();

        const labeledDescriptors = await Promise.all(
          gurus.map(async (guru: any) => {
            if (!guru.foto_referensi) return null;
            try {
              const imgUrl = `https://backendabsen.mejatika.com/storage/${guru.foto_referensi}`;
              const img = await faceapi.fetchImage(imgUrl);
              const fullDesc = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
              return fullDesc ? new faceapi.LabeledFaceDescriptors(guru.id.toString(), [fullDesc.descriptor]) : null;
            } catch (e) { return null; }
          })
        );

        const validDescriptors = labeledDescriptors.filter(d => d !== null) as faceapi.LabeledFaceDescriptors[];
        if (validDescriptors.length > 0) {
          setFaceMatcher(new faceapi.FaceMatcher(validDescriptors, 0.6));
          if (view === "menu") setPesan("⚡ Scanner Siap");
        }
      } catch (err) {
        console.error("Init Error:", err);
      }
    };
    loadSistem();

    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition((pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }), null, { enableHighAccuracy: true });
    }
  }, []);

  // --- 2. SCANNER ENGINE ---
  useEffect(() => {
    let interval: any;
    if (view === "absen" && !isProcessing) {
      interval = setInterval(async () => {
        if (webcamRef.current?.video?.readyState === 4 && !isProcessing) {
          const video = webcamRef.current.video;
          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!detection) {
            setJarakWajah("none");
            setPesan("Sedang Proses biometrik...");
          } else {
            const { width } = detection.detection.box;
            if (width < 100) {
              setJarakWajah("jauh");
              setPesan("Dekatkan Wajah...");
            } else if (width > 250) {
              setJarakWajah("dekat");
              setPesan("Terlalu Dekat!");
            } else {
              setJarakWajah("pas");
              if (faceMatcher) {
                setPesan("Wajah Pas, Tahan...");
                const match = faceMatcher.findBestMatch(detection.descriptor);
                
                if (match.label !== "unknown") {
                  setIsProcessing(true); 
                  clearInterval(interval); 
                  handleRecognitionSuccess(match.label);
                } else {
                  setPesan("Wajah Tidak Dikenal");
                }
              } else {
                setPesan("Sinkronisasi Data...");
              }
            }
          }
        }
      }, 500); 
    }
    return () => clearInterval(interval);
  }, [view, faceMatcher, isProcessing, coords]);

  // --- 3. LOGIKA PULANG CEPAT ---
  const handleRecognitionSuccess = async (guruId: string) => {
    const sekarang = new Date();
    const jam = sekarang.getHours();
    const menit = sekarang.getMinutes();
    const totalMenit = jam * 60 + menit;

    // Range Pulang Cepat: 07:15 (435m) sampai 12:44 (764m)
    if (totalMenit >= 435 && totalMenit <= 764) {
      const { value: status } = await Swal.fire({
        title: "Pulang Cepat",
        text: "Pilih alasan Anda:",
        icon: "warning",
        input: "select",
        inputOptions: {
          "Izin Pulang Cepat": "Izin",
          "Sakit": "Sakit",
        },
        inputPlaceholder: "-- Pilih Alasan --",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        allowOutsideClick: false
      });

      if (status) {
        sendToServer(guruId, coords?.lat || 0, coords?.lng || 0, status);
      } else {
        setIsProcessing(false);
        setPesan("Scan Ulang...");
      }
    } else {
      sendToServer(guruId, coords?.lat || 0, coords?.lng || 0);
    }
  };

  // --- 4. KIRIM DATA KE API ---
  const sendToServer = async (guruId: string, lat: number, lng: number, statusTambahan?: string) => {
    setPesan("Mengirim Data...");
    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          guru_id: guruId, 
          lat, 
          lng,
          status_tambahan: statusTambahan 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        Swal.fire({ 
          title: "Berhasil!", 
          text: data.message || "Absensi tercatat.", 
          icon: "success", 
          timer: 2000, 
          showConfirmButton: false 
        });
        setTimeout(() => router.push("/dashboard-absensi"), 2000);
      } else {
        // JIKA GAGAL (Termasuk: Batas Waktu 14.00 Telah Lewat)
        Swal.fire({
          title: "Peringatan",
          text: data.message || "Gagal menyimpan",
          icon: "warning",
          timer: 2000, 
          showConfirmButton: false
        });

        // AUTO CLOSE & KEMBALI KE MENU UTAMA
        setTimeout(() => {
          setIsProcessing(false);
          setView("menu");
          setPesan("⚡ Scanner Siap");
        }, 2000);
      }
    } catch (e: any) {
      setIsProcessing(false);
      setPesan("Koneksi Error...");
      Swal.fire({
        title: "Gagal",
        text: "Koneksi terputus",
        icon: "error",
        timer: 2000,
        showConfirmButton: false
      });
      setTimeout(() => setView("menu"), 2000);
    }
  };

  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik">
        <div className="w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-16 h-16 bg-red-600 rounded-2xl mx-auto flex items-center justify-center shadow-xl mb-4 text-white text-3xl font-black italic">⚡</div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase mb-8">Turbo Recognition</h1>
          <button onClick={() => setView("absen")} className="w-full py-5 bg-red-600 hover:scale-105 active:scale-95 text-white rounded-2xl font-black shadow-lg transition-all text-lg">🚀 ABSEN SEKARANG</button>
          <button onClick={() => router.push("/admin/login")} className="mt-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-red-600 transition-all">🔐 Admin Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center p-4 relative bg-batik overflow-hidden">
      <div className="w-full max-w-md flex justify-start mt-2 mb-2">
        <button onClick={() => { setView("menu"); setIsProcessing(false); }} className="bg-red-600 px-4 py-2 rounded-xl text-white text-[10px] font-black z-50 shadow-lg">← KEMBALI</button>
      </div>

      <div className="relative w-full max-w-md aspect-[3/4] rounded-[40px] overflow-hidden border-4 border-white bg-slate-900 shadow-2xl mb-6">
        <Webcam ref={webcamRef} audio={false} videoConstraints={videoConstraints} className="w-full h-full object-cover" />
        <div className={`absolute left-0 w-full h-[3px] bg-red-500 shadow-[0_0_20px_rgba(239,68,68,1)] z-20 animate-scan ${jarakWajah === 'pas' ? 'opacity-30' : ''}`}></div>
        <div className="absolute bottom-0 w-full z-30 bg-gradient-to-t from-black/95 via-black/40 to-transparent pt-12 pb-6 px-6">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 shadow-2xl">
                <div className="flex justify-between items-center mb-3 text-white">
                    <div className="space-y-1 text-left">
                        <p className="text-[8px] text-red-400 font-bold uppercase tracking-widest">Latitude</p>
                        <p className="text-[11px] font-mono font-bold leading-none">{coords ? coords.lat.toFixed(7) : "Locking..."}</p>
                    </div>
                    <div className="w-[1px] h-6 bg-white/20"></div>
                    <div className="space-y-1 text-right">
                        <p className="text-[8px] text-red-400 font-bold uppercase tracking-widest">Longitude</p>
                        <p className="text-[11px] font-mono font-bold leading-none">{coords ? coords.lng.toFixed(7) : "Locking..."}</p>
                    </div>
                </div>
                <div className="border-t border-white/10 pt-3 flex flex-col items-center">
                    <span className={`text-[14px] font-black uppercase italic tracking-tighter transition-all duration-300 ${jarakWajah === 'pas' ? 'text-green-400 scale-110' : 'text-amber-300'}`}>{pesan}</span>
                    <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                        <div className={`h-full bg-red-600 transition-all duration-700 ${jarakWajah === "pas" ? "w-full" : "w-1/4"}`}></div>
                    </div>
                </div>
            </div>
        </div>
      </div>
      <div className="w-full max-w-md px-6 text-center opacity-30">
        <p className="text-slate-800 font-black text-[9px] tracking-[0.4em] uppercase italic">Sanpio Turbo-Sync Engine</p>
      </div>
      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }
        .animate-scan { animation: scan 2.5s ease-in-out infinite; }
        @keyframes scan { 0% { top: 5%; } 50% { top: 95%; } 100% { top: 5%; } }
      `}</style>
    </div>
  );
}
