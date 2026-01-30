"use client";
import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

interface Guru {
  id: number;
  foto_referensi: string;
}

export default function HomeAbsensi() {
  const [view, setView] = useState<"menu" | "absen">("menu");
  const webcamRef = useRef<Webcam>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pesan, setPesan] = useState("Menyiapkan Sistem...");
  const [jarakWajah, setJarakWajah] = useState<"pas" | "jauh" | "dekat" | "none">("none");
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const router = useRouter();

  // Konfigurasi Lokasi Sekolah (Sesuaikan lat & lng sekolahmu)
  const schoolCoords = { lat: -6.2000, lng: 106.8000 };
  const maxRadius = 50; // dalam meter

  // 1. LOAD MODELS & DATABASE GURU (Optimization: Tiny Detector)
  useEffect(() => {
    const initEverything = async () => {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        const res = await fetch("https://backendabsen.mejatika.com/api/admin/guru/referensi");
        if (res.ok) {
          const gurus: Guru[] = await res.json();
          const labeledDescriptors = await Promise.all(
            gurus.map(async (g) => {
              try {
                const img = await faceapi.fetchImage(`https://backendabsen.mejatika.com/storage/${g.foto_referensi}`);
                const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                  .withFaceLandmarks()
                  .withFaceDescriptor();
                return detection ? new faceapi.LabeledFaceDescriptors(g.id.toString(), [detection.descriptor]) : null;
              } catch (e) { return null; }
            })
          );

          const validDescriptors = labeledDescriptors.filter((d): d is faceapi.LabeledFaceDescriptors => d !== null);
          if (validDescriptors.length > 0) {
            // Threshold 0.35: Sangat cepat & toleran terhadap cahaya
            setFaceMatcher(new faceapi.FaceMatcher(validDescriptors, 0.35));
          }
        }
        setModelsLoaded(true);
        setPesan("Sistem Siap");
      } catch (err) {
        console.error("AI Error:", err);
        setPesan("Gagal Load AI");
      }
    };
    initEverything();
  }, []);

  // 2. LOGIKA DETEKSI WAJAH KILAT
  useEffect(() => {
    let interval: any;
    if (view === "absen" && modelsLoaded && !isProcessing) {
      const fastOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 128 });

      interval = setInterval(async () => {
        if (webcamRef.current?.video?.readyState === 4) {
          const video = webcamRef.current.video;
          const detection = await faceapi.detectSingleFace(video, fastOptions);

          if (!detection) {
            setJarakWajah("none");
            setPesan("Mencari Wajah...");
          } else {
            const { width } = detection.box;
            if (width < 100) {
              setJarakWajah("jauh");
              setPesan("Dekatkan Wajah");
            } else if (width > 280) {
              setJarakWajah("dekat");
              setPesan("Terlalu Dekat");
            } else {
              setJarakWajah("pas");
              setPesan("Mencocokkan...");

              if (coords && faceMatcher) {
                const full = await faceapi.detectSingleFace(video, fastOptions)
                  .withFaceLandmarks()
                  .withFaceDescriptor();

                if (full) {
                  const match = faceMatcher.findBestMatch(full.descriptor);
                  if (match.label !== "unknown") {
                    setIsProcessing(true);
                    clearInterval(interval);
                    handleAutoCapture(match.label);
                  }
                }
              }
            }
          }
        }
      }, 150); // Scan setiap 150ms
    }
    return () => clearInterval(interval);
  }, [view, modelsLoaded, coords, isProcessing, faceMatcher]);

  const handleAutoCapture = (id: string) => {
    const image = webcamRef.current?.getScreenshot({ quality: 0.5 }); // Kompres gambar ke 50%
    if (image && coords) sendToServer(image, coords.lat, coords.lng, id);
  };

  // 3. KIRIM DATA KE BACKEND
  const sendToServer = async (image: string, lat: number, lng: number, guru_id: string) => {
    setPesan("Mengirim...");
    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ image, lat, lng, guru_id }),
      });
      
      const data = await res.json();
      if (res.ok) {
        await Swal.fire({ title: "Berhasil!", text: "Absensi Anda telah tercatat.", icon: "success", timer: 2000, showConfirmButton: false });
        router.push("/dashboard-absensi"); // KE DASHBOARD UMUM, BUKAN ADMIN
      } else {
        throw new Error(data.message || "Ditolak Server");
      }
    } catch (e: any) {
      setIsProcessing(false);
      setJarakWajah("none");
      Swal.fire("Gagal Simpan", e.message, "error");
    }
  };

  const getInitialLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setView("absen");
      },
      () => Swal.fire("GPS Error", "Harap aktifkan lokasi!", "error"),
      { enableHighAccuracy: true }
    );
  };

  // UI RENDERING
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik">
        <div className="w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-20 h-20 bg-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-xl mb-4">
            <span className="text-white text-3xl font-black">S</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Sanpio System</h1>
          <p className="text-amber-800 font-bold text-[10px] tracking-widest mt-1 mb-8 italic">PANCASILA & BUDAYA</p>
          <div className="space-y-4">
            <button 
              disabled={!modelsLoaded}
              onClick={getInitialLocation} 
              className={`w-full py-4 ${modelsLoaded ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-300'} text-white rounded-2xl font-bold shadow-lg transition-all active:scale-95`}
            >
              {modelsLoaded ? "🚀 MULAI ABSENSI" : "MENYIAPKAN AI..."}
            </button>
            <button onClick={() => router.push("/admin/login")} className="w-full py-4 bg-white text-slate-700 border-2 border-amber-100 rounded-2xl font-bold hover:bg-amber-50 transition-all active:scale-95">
              🔐 LOGIN ADMIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-4 relative bg-batik overflow-hidden">
      <button onClick={() => { setView("menu"); setIsProcessing(false); }} className="absolute top-6 left-6 z-50 bg-red-600 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-lg">
        ← BATAL
      </button>

      <div className="relative w-full max-w-md aspect-[3/4] rounded-[40px] overflow-hidden border-4 border-white bg-slate-900 shadow-2xl">
        <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} className="w-full h-full object-cover" />
        
        {/* Frame Scanner */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className={`relative w-72 h-72 transition-all duration-500 ${jarakWajah === 'pas' ? 'border-green-500 scale-105' : 'border-red-600'}`}>
                <div className={`absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 rounded-tl-xl ${jarakWajah === 'pas' ? 'border-green-500' : 'border-red-600'}`}></div>
                <div className={`absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 rounded-tr-xl ${jarakWajah === 'pas' ? 'border-green-500' : 'border-red-600'}`}></div>
                <div className={`absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 rounded-bl-xl ${jarakWajah === 'pas' ? 'border-green-500' : 'border-red-600'}`}></div>
                <div className={`absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 rounded-br-xl ${jarakWajah === 'pas' ? 'border-green-500' : 'border-red-600'}`}></div>
                <div className={`absolute w-full h-[2px] animate-scan-red ${jarakWajah === 'pas' ? 'bg-green-400' : 'bg-red-500'}`}></div>
            </div>
        </div>

        {/* Status Bar */}
        <div className="absolute bottom-0 w-full z-30 bg-black/60 backdrop-blur-md p-6">
            <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div className={`h-full bg-red-600 transition-all duration-700 ${jarakWajah === "pas" ? "w-full" : "w-1/4"}`}></div>
                </div>
                <span className="text-[10px] text-white font-black uppercase tracking-widest">{pesan}</span>
            </div>
        </div>
      </div>

      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }
        @keyframes scan-red { 0% { top: 5%; } 100% { top: 95%; } }
        .animate-scan-red { position: absolute; animation: scan-red 2.5s infinite ease-in-out; }
      `}</style>
    </div>
  );
}
