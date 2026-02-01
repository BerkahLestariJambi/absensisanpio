"use client";
import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

export default function HomeAbsensi() {
  const [view, setView] = useState<"menu" | "absen">("menu");
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pesan, setPesan] = useState("Menyiapkan Sistem...");
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [scanStatus, setScanStatus] = useState<"searching" | "locked" | "success">("searching");
  
  const isLocked = useRef(false);
  const scanIntervalRef = useRef<any>(null);

  const router = useRouter();
  const videoConstraints = { width: 320, height: 480, facingMode: "user" as const };

  // --- 1. INITIAL LOAD (Optimasi Kecepatan) ---
  useEffect(() => {
    const loadSistem = async () => {
      try {
        const [configRes, refRes] = await Promise.all([
          fetch("https://backendabsen.mejatika.com/api/setting-app"),
          fetch("https://backendabsen.mejatika.com/api/admin/guru/referensi")
        ]);

        const configData = await configRes.json();
        if (configData.success) setConfig(configData.data);

        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        const gurus = await refRes.json();
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
        setPesan("Gagal memuat sistem");
      }
    };
    loadSistem();

    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("GPS Error:", err), 
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // --- 2. ENGINE SCANNER ---
  useEffect(() => {
    if (view === "absen" && !isProcessing) {
      isLocked.current = false; 
      scanIntervalRef.current = setInterval(async () => {
        if (isProcessing || isLocked.current) return;

        if (webcamRef.current?.video?.readyState === 4 && canvasRef.current) {
          const video = webcamRef.current.video;
          const canvas = canvasRef.current;
          const displaySize = { width: video.videoWidth, height: video.videoHeight };
          faceapi.matchDimensions(canvas, displaySize);

          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          const ctx = canvas.getContext("2d");
          ctx?.clearRect(0, 0, canvas.width, canvas.height);

          if (detection) {
            const { width } = detection.detection.box;
            if (width >= 80 && width <= 280) {
              setScanStatus("locked");
              setPesan("Wajah Terkunci... Mohon Diam");
              if (faceMatcher && !isLocked.current) {
                const match = faceMatcher.findBestMatch(detection.descriptor);
                if (match.label !== "unknown") {
                  isLocked.current = true; 
                  setIsProcessing(true);
                  setScanStatus("success");
                  clearInterval(scanIntervalRef.current); 
                  setPesan("Sinkronisasi Biometrik...");
                  handleRecognitionSuccess(match.label);
                }
              }
            } else { 
              setScanStatus("searching");
              setPesan(width < 80 ? "Dekatkan Wajah..." : "Terlalu Dekat!"); 
            }
          } else { 
            setScanStatus("searching");
            setPesan("Mencari Wajah..."); 
          }
        }
      }, 150); 
    }
    return () => clearInterval(scanIntervalRef.current);
  }, [view, faceMatcher, isProcessing]);

  // --- 3. LOGIKA RECOGNITION SUCCESS (FIXED) ---
  const handleRecognitionSuccess = async (guruId: string) => {
    try {
      const screenshot = webcamRef.current?.getScreenshot();
      
      // 1. Cek status ke server terlebih dahulu
      const checkRes = await fetch(`https://backendabsen.mejatika.com/api/cek-status-absen/${guruId}`);
      const checkData = await checkRes.json();

      // PRIORITAS UTAMA: Jika sudah lengkap, jangan tampilkan dialog lain!
      if (checkData.sudah_lengkap) {
         await Swal.fire({
            title: "ABSENSI LENGKAP",
            html: `Halo <b>${checkData.nama}</b>,<br/>Anda sudah melakukan absensi masuk dan pulang hari ini.`,
            icon: "info",
            showCancelButton: true,
            confirmButtonText: "Ke Dashboard Guru",
            cancelButtonText: "Selesai",
            confirmButtonColor: "#1e293b",
            cancelButtonColor: "#94a3b8",
            allowOutsideClick: false
         }).then((result) => {
            if (result.isConfirmed) router.push("/guru"); // Pindah ke dashboard guru
            else resetScanner();
         });
         return; // Berhenti di sini
      }

      // 2. Jika belum lengkap, cek apakah ini absen pulang cepat?
      const jumlahAbsen = checkData.jumlah_absen || 0;
      const jamSekarangWita = new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date());
      const [h, m] = jamSekarangWita.split(/[.:]/).map(Number);
      const totalMenitSekarang = h * 60 + m;

      const parseConfig = (t: string) => {
          if(!t) return 0;
          const [hh, mm] = t.split(/[.:]/).map(Number);
          return hh * 60 + mm;
      }

      const menitPulangCepat = parseConfig(config?.jam_pulang_cepat_mulai || "07:15");
      const menitPulangNormal = parseConfig(config?.jam_pulang_normal || "12:45");

      // Logika dialog Pulang Cepat
      if (jumlahAbsen > 0 && totalMenitSekarang >= menitPulangCepat && totalMenitSekarang < menitPulangNormal) {
        const { value: alasan } = await Swal.fire({
          title: "PULANG CEPAT",
          text: "Anda terdeteksi pulang mendahului jadwal. Pilih alasan:",
          icon: "warning",
          input: "select",
          inputOptions: { "Izin": "Izin", "Sakit": "Sakit", "Tugas Luar": "Tugas Luar" },
          inputPlaceholder: "-- Pilih Alasan --",
          showCancelButton: true,
          confirmButtonText: "Kirim",
          cancelButtonText: "Batal",
          confirmButtonColor: "#dc2626",
          allowOutsideClick: false,
          inputValidator: (value) => { if (!value) return 'Alasan wajib dipilih!'; }
        });

        if (alasan) sendToServer(guruId, coords?.lat || 0, coords?.lng || 0, screenshot, alasan);
        else resetScanner();
      } else {
        // Absen normal (Masuk atau Pulang tepat waktu)
        sendToServer(guruId, coords?.lat || 0, coords?.lng || 0, screenshot);
      }
    } catch (e) { 
      console.error(e);
      resetScanner(); 
    }
  };

  const resetScanner = () => {
    isLocked.current = false;
    setIsProcessing(false);
    setScanStatus("searching");
    setView("menu");
    setPesan("⚡ Scanner Siap");
  };

  // --- 4. KIRIM KE SERVER ---
  const sendToServer = async (guruId: string, lat: number, lng: number, image?: string | null, statusTambahan?: string) => {
    try {
      if (lat === 0 || lng === 0) {
         await Swal.fire("GPS Belum Siap", "Mohon tunggu sinyal lokasi.", "warning");
         resetScanner();
         return;
      }

      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guru_id: guruId, lat, lng, status_tambahan: statusTambahan, image: image }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        await Swal.fire({
          title: "BERHASIL",
          html: `<div class="text-sm"><b>${data.message}</b><br/>Pukul: ${new Date().toLocaleTimeString('id-ID')}</div>`,
          icon: "success",
          timer: 2000,
          showConfirmButton: false
        });

        const { isConfirmed } = await Swal.fire({
          title: "Dashboard",
          text: "Ingin melihat riwayat Anda sekarang?",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Ya, Dashboard",
          cancelButtonText: "Selesai",
          confirmButtonColor: "#1e293b",
          allowOutsideClick: false
        });

        if (isConfirmed) router.push("/guru");
        else resetScanner();
      } else {
        await Swal.fire("GAGAL", data.message, "error");
        resetScanner();
      }
    } catch (e) {
      Swal.fire("Koneksi Error", "Gagal menghubungi server.", "error");
      resetScanner();
    }
  };

  // --- UI RENDER ---
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik">
        <div className="w-full max-w-sm bg-white/95 rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center overflow-hidden bg-slate-50 rounded-2xl shadow-inner">
            {config?.logo_sekolah && <img src={`https://backendabsen.mejatika.com/storage/${config.logo_sekolah}`} alt="Logo" className="max-h-full object-contain" />}
          </div>
          <h2 className="text-lg font-bold text-slate-700 uppercase mb-1">{config?.nama_sekolah || "Memuat..."}</h2>
          <p className="text-[10px] text-slate-500 font-medium mb-6 uppercase tracking-wider">TP {config?.tahun_pelajaran} | SEM {config?.semester}</p>
          
          <div className="my-6 p-3 bg-amber-50 rounded-xl border border-dashed border-amber-200">
             <p className="text-[11px] text-amber-700 font-bold uppercase italic">
               {coords ? "📍 Lokasi Terdeteksi" : "⌛ Mencari Sinyal GPS..."}
             </p>
          </div>

          <button 
            disabled={!faceMatcher || !coords} 
            onClick={() => setView("absen")} 
            className={`w-full py-5 ${(!faceMatcher || !coords) ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-95'} text-white rounded-2xl font-black shadow-lg text-lg flex items-center justify-center gap-3 transition-all`}
          >
            <span className="text-2xl">👤</span> {faceMatcher ? (coords ? "ABSEN SEKARANG" : "MENUNGGU GPS...") : "LOADING AI..."}
          </button>
          
          <button onClick={() => router.push("/login")} className="mt-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest block w-full text-center hover:text-red-500 transition-colors">🔐 LOGIN SISTEM</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center p-4 relative bg-batik overflow-hidden justify-center">
      <div className="relative w-full max-w-md aspect-[3/4] rounded-[40px] overflow-hidden border-4 border-white bg-slate-900 shadow-2xl">
        <Webcam 
          ref={webcamRef} 
          audio={false} 
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints} 
          className="absolute inset-0 w-full h-full object-cover" 
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />
        
        <div className="absolute top-6 left-0 w-full flex justify-center z-40">
           <div className="bg-black/30 backdrop-blur-md px-4 py-1 rounded-full border border-white/10">
              <p className="text-[9px] text-cyan-400 font-mono tracking-tighter">
                LAT: {coords?.lat.toFixed(6)} | LNG: {coords?.lng.toFixed(6)}
              </p>
           </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
           <div className={`w-56 h-72 rounded-[50px] border-2 transition-all duration-500 
             ${scanStatus === 'searching' ? 'border-white/40 border-dashed' : 
               scanStatus === 'locked' ? 'border-cyan-400 shadow-[0_0_25px_#22d3ee] scale-105' : 
               'border-green-500 shadow-[0_0_40px_#22c55e] scale-110'}`}>
             {scanStatus !== 'searching' && <div className="absolute inset-0 rounded-[50px] animate-pulse-glow border-4 border-transparent"></div>}
           </div>
        </div>
        
        <div className="absolute bottom-0 w-full z-30 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-6 text-center">
            <div className={`mb-2 py-1 px-4 inline-block rounded-full text-[10px] font-black uppercase 
              ${scanStatus === 'searching' ? 'bg-slate-800 text-slate-400' : 'bg-cyan-500 text-white animate-bounce'}`}>
              Instruksi: {scanStatus === 'searching' ? 'Posisikan Wajah' : 'Tahan Posisi'}
            </div>
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20">
                <span className={`text-[14px] font-black uppercase italic tracking-wider transition-colors
                  ${scanStatus === 'success' ? 'text-green-400' : 'text-amber-300'}`}>
                  {pesan}
                </span>
            </div>
        </div>
      </div>

      <div className="w-full max-w-md mt-6 flex justify-center">
        <button 
          onClick={resetScanner} 
          className="bg-white/80 backdrop-blur-md border border-slate-200 px-10 py-4 rounded-2xl text-slate-600 text-[12px] font-black shadow-lg hover:bg-red-50 hover:text-red-600 transition-all active:scale-95"
        >
          ← BATALKAN SCAN
        </button>
      </div>

      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }
        @keyframes pulse-glow {
          0% { box-shadow: 0 0 10px rgba(34, 211, 238, 0.4); }
          50% { box-shadow: 0 0 30px rgba(34, 211, 238, 0.8); }
          100% { box-shadow: 0 0 10px rgba(34, 211, 238, 0.4); }
        }
        .animate-pulse-glow { animation: pulse-glow 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
