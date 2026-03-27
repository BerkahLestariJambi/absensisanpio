"use client";
import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// GLOBAL FLAG agar model tidak diload ulang saat komponen re-render
let modelsLoaded = false;

export default function HomeAbsensi() {
  const [view, setView] = useState("menu");
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [coords, setCoords] = useState(null);
  const [pesan, setPesan] = useState("Menyiapkan Sistem...");
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState(null);
  const [config, setConfig] = useState(null);
  const [scanStatus, setScanStatus] = useState("searching");

  const isLocked = useRef(false);
  const scanIntervalRef = useRef(null);
  const router = useRouter();

  const videoConstraints = {
    width: 720,
    height: 1280,
    facingMode: "user",
    aspectRatio: 9 / 16,
  };

  // --- 1. INITIAL LOAD OPTIMIZED ---
  useEffect(() => {
    const loadSistem = async () => {
      try {
        // A. Ambil Data API secara paralel di awal
        const [configRes, gurus] = await Promise.all([
          api.getSettings(),
          api.getGuruReferensi(),
        ]);
        if (configRes.success) setConfig(configRes.data);

        // B. Load Models Library (Hanya jika belum pernah diload)
        if (!modelsLoaded) {
          const MODEL_URL = "/models";
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          ]);
          modelsLoaded = true;
          console.log("✅ Models Loaded");
        }

        // C. Fast Descriptor Processing (Smart Cache)
        const labeledDescriptors = await Promise.all(
          gurus.map(async (guru) => {
            if (!guru.foto_referensi) return null;

            const cacheKey = `f_cache_${guru.id}_${guru.foto_referensi.replace(/\//g, '_')}`;
            const cached = localStorage.getItem(cacheKey);

            if (cached) {
              return new faceapi.LabeledFaceDescriptors(guru.id.toString(), [
                new Float32Array(JSON.parse(cached))
              ]);
            }

            try {
              const imgUrl = `https://projeckkelasxi.mejatika.com/storage/${guru.foto_referensi}`;
              const img = await faceapi.fetchImage(imgUrl);
              const fullDesc = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

              if (fullDesc) {
                localStorage.setItem(cacheKey, JSON.stringify(Array.from(fullDesc.descriptor)));
                return new faceapi.LabeledFaceDescriptors(guru.id.toString(), [fullDesc.descriptor]);
              }
              return null;
            } catch (e) { return null; }
          })
        );

        const validDescriptors = labeledDescriptors.filter(d => d !== null);
        if (validDescriptors.length > 0) {
          setFaceMatcher(new faceapi.FaceMatcher(validDescriptors, 0.45));
          setPesan("⚡ Scanner Siap");
        }
      } catch (err) {
        setPesan("Gagal memuat sistem");
        console.error(err);
      }
    };

    loadSistem();

    // D. Lokasi GPS (Tetap berjalan di background)
    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        null,
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // --- 2. ENGINE SCANNER (Sama dengan sebelumnya) ---
  useEffect(() => {
    if (view === "absen" && !isProcessing) {
      isLocked.current = false;
      scanIntervalRef.current = setInterval(async () => {
        if (isProcessing || isLocked.current) return;
        if (webcamRef.current?.video?.readyState === 4 && canvasRef.current) {
          const video = webcamRef.current.video;
          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection) {
            const { width } = detection.detection.box;
            if (width >= 120 && width <= 450) {
              setScanStatus("locked");
              setPesan("Wajah Terkunci...");
              if (faceMatcher && !isLocked.current) {
                const match = faceMatcher.findBestMatch(detection.descriptor);
                if (match.label !== "unknown") {
                  isLocked.current = true;
                  setIsProcessing(true);
                  setScanStatus("success");
                  clearInterval(scanIntervalRef.current);
                  handleRecognitionSuccess(match.label);
                }
              }
            } else {
              setScanStatus("searching");
              setPesan(width < 120 ? "Dekatkan Wajah..." : "Terlalu Dekat!");
            }
          } else {
            setScanStatus("searching");
            setPesan("Mencari Wajah...");
          }
        }
      }, 200);
    }
    return () => clearInterval(scanIntervalRef.current);
  }, [view, faceMatcher, isProcessing]);

  // --- 3. HANDLE SUCCESS & SEND DATA ---
  const handleRecognitionSuccess = async (guruId) => {
    try {
      const screenshot = webcamRef.current?.getScreenshot();
      const checkData = await api.checkAbsenStatus(guruId);

      if (checkData.sudah_lengkap) {
        Swal.fire({
          title: "Sudah Absen",
          text: `Halo ${checkData.nama}, Anda sudah absen hari ini.`,
          icon: "info",
          confirmButtonText: "Dashboard",
        }).then(() => router.push(`/guru?id=${guruId}`));
        return;
      }

      // Logika Jam (WITA)
      const now = new Date();
      const jam = now.getHours() * 60 + now.getMinutes();
      const menitPulangCepat = 7 * 60 + 15; // Contoh 07:15

      if ((checkData.jumlah_absen || 0) > 0 && jam >= menitPulangCepat) {
        // Tampilkan prompt alasan jika perlu, atau langsung kirim
        sendToServer(guruId, coords?.lat, coords?.lng, screenshot);
      } else {
        sendToServer(guruId, coords?.lat, coords?.lng, screenshot);
      }
    } catch (e) { resetScanner(); }
  };

  const sendToServer = async (guruId, lat, lng, image) => {
    try {
      if (!lat) return Swal.fire("GPS?", "Lokasi belum terdeteksi", "warning").then(resetScanner);
      await api.submitAbsensi({ guru_id: guruId, lat, lng, image });
      Swal.fire("Berhasil", "Absensi telah tercatat", "success").then(resetScanner);
    } catch (err) { 
      Swal.fire("Gagal", "Error server", "error").then(resetScanner);
    }
  };

  const resetScanner = () => {
    isLocked.current = false;
    setIsProcessing(false);
    setScanStatus("searching");
    setView("menu");
  };

  // --- 4. UI RENDER (Sama seperti sebelumnya) ---
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-[#fdf5e6] flex flex-col items-center justify-center p-6 bg-batik">
        <div className="w-full max-w-sm bg-white/95 rounded-[40px] shadow-2xl p-10 text-center border border-amber-200">
          <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center bg-slate-50 rounded-2xl">
            {config?.logo_sekolah && <img src={`https://projeckkelasxi.mejatika.com/storage/${config.logo_sekolah}`} alt="Logo" className="max-h-full" />}
          </div>
          <h2 className="text-lg font-bold text-slate-700 uppercase">{config?.nama_sekolah || "Memuat..."}</h2>
          
          <div className="my-6 p-3 bg-amber-50 rounded-xl border border-dashed border-amber-200 text-[11px] font-bold text-amber-700">
             {coords ? "📍 GPS AKTIF" : "⌛ MENCARI GPS..."}
          </div>

          <button 
            disabled={!faceMatcher || !coords} 
            onClick={() => setView("absen")} 
            className={`w-full py-5 ${(!faceMatcher || !coords) ? 'bg-slate-300' : 'bg-red-600 hover:bg-red-700'} text-white rounded-2xl font-black shadow-lg transition-all`}
          >
            {faceMatcher ? "MULAI SCAN WAJAH" : "MEMUAT AI..."}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="relative w-full max-w-md aspect-[3/4] rounded-[40px] overflow-hidden border-4 border-white shadow-2xl">
        <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={videoConstraints} className="absolute inset-0 w-full h-full object-cover" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />
        
        <div className="absolute bottom-10 w-full z-30 px-6 text-center">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 text-white font-bold uppercase italic tracking-wider">
               {pesan}
            </div>
        </div>
      </div>
      <button onClick={resetScanner} className="mt-8 text-white/50 font-bold tracking-widest text-xs hover:text-white transition-all">← BATALKAN</button>
    </div>
  );
}
