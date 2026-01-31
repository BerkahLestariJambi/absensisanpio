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
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "detected" | "processing">("idle");
  const [lightOn, setLightOn] = useState(false); 
  
  const isLocked = useRef(false);
  const scanIntervalRef = useRef<any>(null);
  const router = useRouter();

  const videoConstraints = { width: 480, height: 640, facingMode: "user" as const };

  // --- 1. INITIAL LOAD ---
  useEffect(() => {
    const loadSistem = async () => {
      try {
        const configRes = await fetch("https://backendabsen.mejatika.com/api/setting-app");
        const configData = await configRes.json();
        if (configData.success) setConfig(configData.data);

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
              const fullDesc = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();
              return fullDesc ? new faceapi.LabeledFaceDescriptors(guru.id.toString(), [fullDesc.descriptor]) : null;
            } catch (e) { return null; }
          })
        );

        const validDescriptors = labeledDescriptors.filter(d => d !== null) as faceapi.LabeledFaceDescriptors[];
        if (validDescriptors.length > 0) {
          setFaceMatcher(new faceapi.FaceMatcher(validDescriptors, 0.6));
          if (view === "menu") setPesan("⚡ Scanner Siap");
        }
      } catch (err) { setPesan("Gagal memuat sistem"); }
    };
    loadSistem();

    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        null, { enableHighAccuracy: true }
      );
    }
  }, []);

  // --- 2. ENGINE SCANNER (FIXED TYPE ERROR) ---
  useEffect(() => {
    if (view === "absen" && !isProcessing) {
      isLocked.current = false; 
      scanIntervalRef.current = setInterval(async () => {
        if (isProcessing || isLocked.current) return;

        if (webcamRef.current?.video?.readyState === 4) {
          const video = webcamRef.current.video;
          
          // Fix: Tambahkan withFaceLandmarks() sebelum withFaceDescriptor()
          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection) {
            const width = detection.box.width;
            if (width >= 80 && width <= 280) {
              setScanStatus("detected");
              if (faceMatcher && !isLocked.current) {
                const match = faceMatcher.findBestMatch(detection.descriptor);
                if (match.label !== "unknown") {
                  isLocked.current = true; 
                  setIsProcessing(true);
                  setScanStatus("processing");
                  clearInterval(scanIntervalRef.current); 
                  handleRecognitionSuccess(match.label);
                }
              }
            } else {
              setScanStatus("idle");
              setPesan(width < 80 ? "Dekatkan Wajah..." : "Terlalu Dekat!");
            }
          } else {
            setScanStatus("idle");
            setPesan("Mencari Wajah...");
          }
        }
      }, 200); 
    }
    return () => clearInterval(scanIntervalRef.current);
  }, [view, faceMatcher, isProcessing]);

  // --- 3. LOGIKA FLASH LAMP (HARDWARE TORCH) ---
  const handleToggleLight = async () => {
    const nextStatus = !lightOn;
    setLightOn(nextStatus);

    // Coba akses hardware flash (Android)
    if (webcamRef.current?.video) {
      const stream = webcamRef.current.video.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      try {
        const capabilities = track.getCapabilities() as any;
        if (capabilities.torch) {
          await track.applyConstraints({ advanced: [{ torch: nextStatus }] } as any);
        }
      } catch (e) { /* Torch not supported, fallback to Screen Flash (CSS) */ }
    }
  };

  // --- 4. LOGIKA RECOGNITION SUCCESS ---
  const handleRecognitionSuccess = async (guruId: string) => {
    try {
      const screenshot = webcamRef.current?.getScreenshot();
      const checkRes = await fetch(`https://backendabsen.mejatika.com/api/cek-status-absen/${guruId}`);
      const checkData = await checkRes.json();
      
      const jamSekarangWita = new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date());
      const [h, m] = jamSekarangWita.split(/[.:]/).map(Number);
      const now = h * 60 + m;

      const parseT = (t: string) => {
          if(!t) return 0;
          const [hh, mm] = t.split(/[.:]/).map(Number);
          return hh * 60 + mm;
      }

      if (checkData.jumlah_absen > 0 && now >= parseT(config?.jam_pulang_cepat_mulai) && now < parseT(config?.jam_pulang_normal)) {
        const { value: alasan } = await Swal.fire({
          title: "PULANG CEPAT",
          input: "select",
          inputOptions: { "Izin": "Izin", "Sakit": "Sakit", "Tugas Luar": "Tugas Luar" },
          inputPlaceholder: "-- Pilih Alasan --",
          showCancelButton: true,
          confirmButtonText: "Kirim",
          inputValidator: (v) => !v && 'Alasan wajib dipilih!'
        });
        if (alasan) sendToServer(guruId, coords?.lat || 0, coords?.lng || 0, screenshot, alasan);
        else resetScanner();
      } else {
        sendToServer(guruId, coords?.lat || 0, coords?.lng || 0, screenshot);
      }
    } catch (e) { resetScanner(); }
  };

  const sendToServer = async (guruId: string, lat: number, lng: number, image?: string | null, statusTambahan?: string) => {
    if (lat === 0 || lng === 0) {
      await Swal.fire("GPS Belum Siap", "Mohon tunggu...", "warning");
      return resetScanner();
    }
    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guru_id: guruId, lat, lng, status_tambahan: statusTambahan, image }),
      });
      const data = await res.json();
      if (res.ok) {
        await Swal.fire({ title: "BERHASIL", html: data.message, icon: "success", timer: 2000, showConfirmButton: false });
        router.push("/dashboard-absensi");
      } else {
        await Swal.fire("GAGAL", data.message, "error");
        resetScanner();
      }
    } catch (e) { resetScanner(); }
  };

  const resetScanner = () => {
    isLocked.current = false;
    setIsProcessing(false);
    setScanStatus("idle");
    setLightOn(false);
    setView("menu");
  };

  // --- RENDER MENU ---
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex items-center justify-center p-6 bg-batik">
        <div className="w-full max-sm bg-white/95 rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-20 h-20 mx-auto mb-4 bg-slate-50 rounded-2xl flex items-center justify-center p-2">
            {config?.logo_sekolah && <img src={`https://backendabsen.mejatika.com/storage/${config.logo_sekolah}`} className="max-h-full" alt="logo" />}
          </div>
          <h2 className="text-md font-black text-slate-700 uppercase tracking-tight">{config?.nama_sekolah || "SISTEM ABSENSI"}</h2>
          <div className="my-6 text-[11px] text-amber-700 font-bold bg-amber-50 py-2 rounded-full border border-amber-100">
            {coords ? "📍 GPS TERKUNCI" : "⌛ MENCARI GPS..."}
          </div>
          <button disabled={!faceMatcher || !coords} onClick={() => setView("absen")} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all">
            MULAI SCAN WAJAH
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER CAMERA ---
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-500 ${lightOn ? 'bg-white' : 'bg-black'}`}>
      
      <div className="relative w-full max-w-md aspect-[3/4] overflow-hidden bg-slate-900 shadow-2xl z-10">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className={`absolute inset-0 transition-all duration-500 border-[12px] z-20 
          ${scanStatus === "idle" ? (lightOn ? "border-slate-200" : "border-white/20") : 
            scanStatus === "detected" ? "border-cyan-400 shadow-[inset_0_0_50px_rgba(34,211,238,0.4)]" : 
            "border-green-500 shadow-[inset_0_0_100px_rgba(34,197,94,0.6)]"}`} 
        />

        <div className={`absolute left-0 w-full h-[2px] z-30 
          ${scanStatus === "processing" ? "bg-green-400 shadow-[0_0_15px_#4ade80]" : "bg-cyan-400 shadow-[0_0_15px_#22d3ee]"}
          animate-scan`} 
        />

        <div className="absolute top-6 w-full px-6 flex justify-between z-50">
          <button onClick={resetScanner} className="bg-black/60 text-white px-4 py-2 rounded-full text-[10px] font-bold backdrop-blur-md border border-white/10">
            ← BATAL
          </button>
          <button onClick={handleToggleLight} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${lightOn ? 'bg-yellow-400 text-black scale-110' : 'bg-white/10 text-white border border-white/20 backdrop-blur-md'}`}>
            <span className="text-lg">{lightOn ? "💡" : "🔦"}</span>
          </button>
        </div>

        <div className="absolute bottom-10 w-full px-10 z-40">
          <div className={`${lightOn ? 'bg-white/90 border-slate-200' : 'bg-black/60 border-white/10'} backdrop-blur-md border rounded-2xl py-3 px-4 text-center transition-colors`}>
            <p className={`text-xs font-black uppercase tracking-widest ${scanStatus === 'idle' ? (lightOn ? 'text-slate-800' : 'text-white') : 'text-cyan-500 animate-pulse'}`}>
              {isProcessing ? "Sinkronisasi..." : pesan}
            </p>
          </div>
        </div>
      </div>

      {lightOn && <div className="absolute inset-0 bg-white shadow-[inset_0_0_150px_rgba(255,255,255,1)] z-0 animate-pulse" />}

      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }
        @keyframes scan {
          0% { top: 10%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .animate-scan { animation: scan 2s linear infinite; }
      `}</style>
    </div>
  );
}
