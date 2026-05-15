"use client";
import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

// --- HELPER VOICE ANNOUNCER ---
let lastSpeechTime = 0;
const playVoice = (text: string, cooldownMs: number = 4000) => {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    const now = Date.now();
    if (now - lastSpeechTime < cooldownMs) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 1.1;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find((v) => v.lang.includes("id-ID"));
    if (idVoice) utterance.voice = idVoice;

    window.speechSynthesis.speak(utterance);
    lastSpeechTime = now;
  }
};

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
  const faceBuffer = useRef(0);
  const unknownBuffer = useRef(0);

  const router = useRouter();

  const videoConstraints = {
    facingMode: "user" as const,
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 720,
  };

  // --- 1. INITIAL LOAD ---
  useEffect(() => {
    let isMounted = true;
    const loadSistem = async () => {
      try {
        const MODEL_URL = "/models";
        const [configRes, _models] = await Promise.all([
          fetch("https://backendabsen.mejatika.com/api/setting-app").then((res) => res.json()),
          Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          ]),
        ]);

        if (isMounted && configRes.success) setConfig(configRes.data);

        const refRes = await fetch("https://backendabsen.mejatika.com/api/admin/guru/referensi");
        const gurus = await refRes.json();

        const labeledDescriptors = await Promise.all(
          gurus.map(async (guru: any) => {
            if (!guru.foto_referensi) return null;
            try {
              const imgUrl = `https://backendabsen.mejatika.com/storage/${guru.foto_referensi}`;
              const img = await faceapi.fetchImage(imgUrl);
              const fullDesc = await faceapi.detectSingleFace(
                img,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 160 })
              )
                .withFaceLandmarks()
                .withFaceDescriptor();
              return fullDesc
                ? new faceapi.LabeledFaceDescriptors(guru.id.toString(), [fullDesc.descriptor])
                : null;
            } catch (e) {
              return null;
            }
          })
        );

        const validDescriptors = labeledDescriptors.filter((d) => d !== null) as faceapi.LabeledFaceDescriptors[];

        if (isMounted && validDescriptors.length > 0) {
          setFaceMatcher(new faceapi.FaceMatcher(validDescriptors, 0.45));
          if (view === "menu") setPesan("⚡ Scanner Siap");
        }
      } catch (err) {
        if (isMounted) {
          setPesan("Gagal memuat sistem");
          playVoice("Gagal memuat sistem biometrik.");
        }
      }
    };

    loadSistem();

    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          console.error("GPS Error:", err);
          playVoice("Sinyal GPS tidak ditemukan. Mohon aktifkan lokasi.");
        },
        { enableHighAccuracy: true }
      );
      return () => {
        isMounted = false;
        navigator.geolocation.clearWatch(watchId);
      };
    }
    return () => { isMounted = false; };
  }, [view]);

  // --- 2. ENGINE SCANNER ---
  useEffect(() => {
    if (view === "absen" && !isProcessing) {
      isLocked.current = false;
      faceBuffer.current = 0;
      unknownBuffer.current = 0;
      playVoice("Sistem aktif, silakan posisikan wajah Anda.");

      scanIntervalRef.current = setInterval(async () => {
        if (isProcessing || isLocked.current) return;
        if (webcamRef.current?.video?.readyState === 4 && canvasRef.current) {
          const video = webcamRef.current.video;
          const canvas = canvasRef.current;
          const displaySize = { width: video.clientWidth, height: video.clientHeight };
          faceapi.matchDimensions(canvas, displaySize);

          const detection = await faceapi.detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
          )
            .withFaceLandmarks()
            .withFaceDescriptor();

          const ctx = canvas.getContext("2d");
          ctx?.clearRect(0, 0, canvas.width, canvas.height);

          if (detection) {
            const resizedDetections = faceapi.resizeResults(detection, displaySize);
            const { width } = resizedDetections.detection.box;

            if (width >= 80 && width <= 350) {
              setScanStatus("locked");
              if (faceMatcher && !isLocked.current) {
                const match = faceMatcher.findBestMatch(resizedDetections.descriptor);
                if (match.label !== "unknown") {
                  unknownBuffer.current = 0;
                  faceBuffer.current++;
                  setPesan("Wajah Terkunci... Mohon Diam");
                  if (faceBuffer.current === 1) playVoice("Wajah terkunci, mohon jangan bergerak.");
                  if (faceBuffer.current >= 2) {
                    isLocked.current = true;
                    setIsProcessing(true);
                    setScanStatus("success");
                    clearInterval(scanIntervalRef.current);
                    setPesan("Sinkronisasi Biometrik...");
                    playVoice("Sinkronisasi biometrik, mohon tunggu.");
                    handleRecognitionSuccess(match.label);
                  }
                } else {
                  faceBuffer.current = 0;
                  unknownBuffer.current++;
                  setPesan("Mencocokkan...");
                  if (unknownBuffer.current >= 15) {
                    isLocked.current = true;
                    clearInterval(scanIntervalRef.current);
                    playVoice("Wajah tidak cocok. Mohon gunakan akun yang terdaftar.");
                    Swal.fire({
                      title: "WAJAH TIDAK COCOK",
                      text: "Wajah Anda tidak terdaftar atau tidak dikenali oleh sistem.",
                      icon: "error",
                      confirmButtonText: "Coba Lagi",
                      confirmButtonColor: "#dc2626",
                    }).then(() => { resetScanner(); });
                  }
                }
              }
            } else {
              faceBuffer.current = 0;
              unknownBuffer.current = 0;
              setScanStatus("searching");
              setPesan(width < 80 ? "Dekatkan Wajah..." : "Terlalu Dekat!");
            }
          } else {
            faceBuffer.current = 0;
            unknownBuffer.current = 0;
            setScanStatus("searching");
            setPesan("Mencari Wajah...");
          }
        }
      }, 150);
    }
    return () => clearInterval(scanIntervalRef.current);
  }, [view, faceMatcher, isProcessing]);

  // --- 3. LOGIKA SUCCESS & SERVER ---
  const handleRecognitionSuccess = async (guruId: string) => {
    try {
      const screenshot = webcamRef.current?.getScreenshot();
      const checkRes = await fetch(`https://backendabsen.mejatika.com/api/cek-status-absen/${guruId}`);
      const checkData = await checkRes.json();

      if (checkData.sudah_lengkap) {
        playVoice(`Halo ${checkData.nama}, Anda sudah melakukan absensi hari ini.`);
        await Swal.fire({
          title: "SUDAH LENGKAP",
          html: `Halo <b>${checkData.nama}</b>,<br/>Anda sudah absen masuk & pulang hari ini.`,
          icon: "info",
          showCancelButton: true,
          confirmButtonText: "Ke Dashboard Guru",
          cancelButtonText: "Kembali",
          confirmButtonColor: "#1e293b",
          allowOutsideClick: false,
        }).then((result) => {
          if (result.isConfirmed) {
            if (document.fullscreenElement) document.exitFullscreen();
            router.push(`/guru?id=${guruId}`);
          } else {
            resetScanner();
          }
        });
        return;
      }

      const jumlahAbsen = checkData.jumlah_absen || 0;
      const sekarang = new Date();
      const jamSekarangWita = sekarang.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Makassar",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const [h, m] = jamSekarangWita.split(":").map(Number);
      const totalMenitSekarang = h * 60 + m;
      const parseConfig = (t: string) => {
        if (!t) return 0;
        const [hh, mm] = t.split(/[.:]/).map(Number);
        return hh * 60 + mm;
      };

      const menitPulangCepat = parseConfig(config?.jam_pulang_cepat_mulai || "07:15");
      const menitPulangNormal = parseConfig(config?.jam_pulang_normal || "12:45");

      if (jumlahAbsen > 0 && totalMenitSekarang >= menitPulangCepat && totalMenitSekarang < menitPulangNormal) {
        playVoice("Jadwal pulang belum tiba. Silakan pilih alasan pulang cepat.");
        const { value: alasan } = await Swal.fire({
          title: "PULANG CEPAT",
          text: "Pilih alasan pulang mendahului jadwal:",
          icon: "warning",
          input: "select",
          inputOptions: { Izin: "Izin", Sakit: "Sakit", "Tugas Luar": "Tugas Luar" },
          inputPlaceholder: "-- Pilih Alasan --",
          showCancelButton: true,
          confirmButtonText: "Kirim",
          cancelButtonText: "Batal",
          confirmButtonColor: "#dc2626",
          allowOutsideClick: false,
          inputValidator: (value) => { if (!value) return "Alasan wajib dipilih!"; },
        });
        if (alasan) sendToServer(guruId, coords?.lat || 0, coords?.lng || 0, screenshot, alasan);
        else resetScanner();
      } else {
        sendToServer(guruId, coords?.lat || 0, coords?.lng || 0, screenshot);
      }
    } catch (e) { resetScanner(); }
  };

  const sendToServer = async (guruId: string, lat: number, lng: number, image?: string | null, statusTambahan?: string) => {
    try {
      if (!navigator.onLine) {
        playVoice("Koneksi internet buruk. Mohon periksa jaringan Anda.");
        await Swal.fire("Offline", "Tidak ada koneksi internet.", "error");
        resetScanner();
        return;
      }
      if (lat === 0 || lng === 0) {
        playVoice("Gagal mengambil lokasi GPS.");
        await Swal.fire("GPS Belum Siap", "Mohon tunggu sinyal lokasi.", "warning");
        resetScanner();
        return;
      }

      const res = await fetch("https://backendabsen.mejatika.com/api/simpan-absen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guru_id: guruId,
          lat,
          lng,
          status_tambahan: statusTambahan,
          image: image,
          client_time: new Date().toISOString(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        playVoice("Absensi berhasil. Terima kasih.");
        await Swal.fire({
          title: "BERHASIL",
          html: `<div class="text-sm"><b>${data.message}</b><br/>${new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar" })} WITA</div>`,
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });

        const { isConfirmed } = await Swal.fire({
          title: "Absensi Selesai",
          text: "Lihat riwayat di Dashboard Anda?",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Ya, Dashboard",
          cancelButtonText: "Selesai",
          confirmButtonColor: "#1e293b",
          allowOutsideClick: false,
        });

        if (isConfirmed) {
          if (document.fullscreenElement) document.exitFullscreen();
          router.push(`/guru?id=${guruId}`);
        } else { resetScanner(); }
      } else {
        playVoice("Gagal menyimpan absensi.");
        await Swal.fire("GAGAL", data.message, "error");
        resetScanner();
      }
    } catch (e) {
      playVoice("Terjadi kesalahan koneksi server.");
      Swal.fire("Error", "Gagal menghubungi server.", "error");
      resetScanner();
    }
  };

  const resetScanner = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    isLocked.current = false;
    setIsProcessing(false);
    faceBuffer.current = 0;
    unknownBuffer.current = 0;
    setScanStatus("searching");
    setView("menu");
    setPesan("⚡ Scanner Siap");
  };

  const handleStartAbsen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    }
    setView("absen");
  };

// --- UI RENDER: MENU UTAMA ---
if (view === "menu") {
  return (
    <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* 1. WATERMARK BACKGROUND LAYAR (BIRU & RAPAT) */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 opacity-[0.08]" 
        style={{ 
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='100'><text x='50%' y='50%' font-size='10' font-weight='bold' fill='%230000FF' font-family='sans-serif' text-anchor='middle' transform='rotate(-25 75 50)'>${config?.nama_sekolah || ''}</text></svg>")`,
          backgroundRepeat: 'repeat'
        }}
      ></div>

      {/* 2. KARTU UTAMA (FRAME) */}
      <div className="relative z-10 w-full max-w-sm bg-white/95 rounded-[40px] shadow-2xl p-10 text-center border border-amber-200 overflow-hidden">
        
        {/* WATERMARK KHUSUS DI DALAM FRAME KARTU */}
        <div 
          className="absolute inset-0 pointer-events-none z-0 opacity-[0.06]" 
          style={{ 
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80'><text x='50%' y='50%' font-size='9' font-weight='bold' fill='%230000FF' font-family='sans-serif' text-anchor='middle' transform='rotate(-25 60 40)'>${config?.nama_sekolah || ''}</text></svg>")`,
            backgroundRepeat: 'repeat'
          }}
        ></div>

        {/* KONTEN DI DALAM FRAME (Beri z-10 agar berada di atas watermark frame) */}
        <div className="relative z-10">
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center overflow-hidden bg-slate-50 rounded-2xl shadow-inner border border-slate-100">
            {config?.logo_sekolah && (
              <img
                src={`https://backendabsen.mejatika.com/storage/${config.logo_sekolah}`}
                alt="Logo"
                className="max-h-full object-contain"
              />
            )}
          </div>
          <h2 className="text-lg font-bold text-slate-700 uppercase mb-1 leading-tight">
            {config?.nama_sekolah || "Memuat..."}
          </h2>
          <p className="text-[10px] text-slate-500 font-medium mb-6 uppercase tracking-wider">
            TP {config?.tahun_pelajaran} | SEM {config?.semester}
          </p>

          <div className="my-6 p-3 bg-amber-50/80 backdrop-blur-sm rounded-xl border border-dashed border-amber-200">
            <p className="text-[11px] text-amber-700 font-bold uppercase italic">
              {coords ? "📍 Lokasi Terdeteksi" : "⌛ Mencari Sinyal GPS..."}
            </p>
          </div>

          <button
            disabled={!faceMatcher || !coords}
            onClick={handleStartAbsen}
            className={`w-full py-5 ${
              !faceMatcher || !coords
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700 active:scale-95"
            } text-white rounded-2xl font-black shadow-lg text-lg flex items-center justify-center gap-3 transition-all`}
          >
            <span className="text-2xl">👤</span>{" "}
            {faceMatcher
              ? coords
                ? "ABSEN SEKARANG"
                : "MENUNGGU GPS..."
              : "LOADING DATA..."}
          </button>

          <button
            onClick={() => router.push("/admin/login")}
            className="mt-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest block w-full text-center hover:text-red-500 transition-colors"
          >
            🔐 LOGIN ADMIN / KEPSEK
          </button>
        </div>
      </div>
    </div>
  );
}
  // --- UI RENDER: SCANNER WAJAH ---
  return (
    <div className="fixed inset-0 z-[999] bg-black overflow-hidden flex flex-col items-center justify-center">
      <div className="absolute inset-0 w-full h-full">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 object-cover" />
      </div>

      <div className="absolute top-10 left-0 w-full flex flex-col items-center gap-2 z-40 px-6">
        <div className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20">
          <p className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">
            📍 {coords ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : "Mencari GPS..."}
          </p>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
        <div
          className={`w-[280px] h-[380px] md:w-[320px] md:h-[450px] rounded-[60px] border-[3px] transition-all duration-500 
          ${
            scanStatus === "searching"
              ? "border-white/30 border-dashed"
              : scanStatus === "locked"
              ? "border-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.5)] scale-105"
              : "border-green-500 shadow-[0_0_60px_rgba(34,197,94,0.6)] scale-110"
          }`}
        >
          {scanStatus !== "searching" && (
            <div className="absolute inset-0 rounded-[50px] animate-pulse-glow border-4 border-transparent"></div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 w-full z-30 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-8 pb-12 text-center">
        <div
          className={`mb-4 py-2 px-6 inline-block rounded-full text-[11px] font-black uppercase tracking-widest
          ${
            scanStatus === "searching"
              ? "bg-slate-800 text-slate-400"
              : "bg-cyan-500 text-white animate-bounce"
          }`}
        >
          {scanStatus === "searching" ? "Posisikan Wajah Anda" : "Wajah Terkunci"}
        </div>

        <div className="bg-white/10 backdrop-blur-2xl rounded-[30px] p-6 border border-white/20 max-w-sm mx-auto shadow-2xl">
          <span
            className={`text-lg font-black uppercase italic tracking-wide block transition-colors
            ${scanStatus === "success" ? "text-green-400" : "text-amber-300"}`}
          >
            {pesan}
          </span>
        </div>

        <button
          onClick={resetScanner}
          className="mt-8 bg-white/10 hover:bg-red-500/20 backdrop-blur-md border border-white/20 px-8 py-3 rounded-2xl text-white text-[11px] font-bold tracking-widest transition-all active:scale-95"
        >
          BATALKAN ABSENSI
        </button>
      </div>

      <style jsx>{`
        .animate-pulse-glow {
          animation: pulse-glow 1.5s ease-in-out infinite;
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(34, 211, 238, 0.2); }
          50% { box-shadow: 0 0 40px rgba(34, 211, 238, 0.6); }
        }
      `}</style>
    </div>
  );
}
