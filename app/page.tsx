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
  const [pesan, setPesan] = useState("Menyiapkan...");
  const [jarakWajah, setJarakWajah] = useState<"pas" | "jauh" | "dekat" | "none">("none");
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const router = useRouter();

  // Koordinat Sekolah
  const schoolCoords = { lat: -6.2000, lng: 106.8000 };
  const maxRadius = 50;

  // 1. LOAD MODELS (Sangat Cepat dengan Tiny Detector)
  useEffect(() => {
    const initAI = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);

        const res = await fetch("https://backendabsen.mejatika.com/api/admin/guru/referensi");
        const gurus = await res.json();
        
        const descriptors = await Promise.all(gurus.map(async (g: any) => {
          const img = await faceapi.fetchImage(`https://backendabsen.mejatika.com/storage/${g.foto_referensi}`);
          const det = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
          return det ? new faceapi.LabeledFaceDescriptors(g.id.toString(), [det.descriptor]) : null;
        }));

        const validDescriptors = descriptors.filter(d => d !== null) as faceapi.LabeledFaceDescriptors[];
        // Threshold 0.35: Sangat cepat mengenali, sangat toleran terhadap cahaya
        if (validDescriptors.length > 0) setFaceMatcher(new faceapi.FaceMatcher(validDescriptors, 0.35));
        
        setModelsLoaded(true);
      } catch (err) { setPesan("AI Error"); }
    };
    initAI();
  }, []);

  // 2. LOGIKA DETEKSI KILAT (Skip Frame & Low Resolution)
  useEffect(() => {
    if (view !== "absen" || !modelsLoaded || isProcessing) return;

    const fastOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 128 }); // 128 = Tercepat
    const interval = setInterval(async () => {
      if (webcamRef.current?.video?.readyState === 4) {
        const video = webcamRef.current.video;
        const detection = await faceapi.detectSingleFace(video, fastOptions);

        if (!detection) {
          setJarakWajah("none");
          setPesan("Cari Wajah...");
          return;
        }

        const box = detection.box;
        if (box.width < 100) { setJarakWajah("jauh"); setPesan("Dekat Lagi"); }
        else if (box.width > 280) { setJarakWajah("dekat"); setPesan("Jauh Sedikit"); }
        else {
          setJarakWajah("pas");
          setPesan("Match...");

          // Hanya hitung Descriptor jika sudah "PAS"
          if (faceMatcher && coords) {
            const full = await faceapi.detectSingleFace(video, fastOptions).withFaceLandmarks().withFaceDescriptor();
            if (full) {
              const match = faceMatcher.findBestMatch(full.descriptor);
              if (match.label !== "unknown") {
                setIsProcessing(true);
                clearInterval(interval);
                handleCapture(match.label);
              }
            }
          }
        }
      }
    }, 150); // Scan setiap 150ms
    return () => clearInterval(interval);
  }, [view, modelsLoaded, isProcessing, faceMatcher, coords]);

  const handleCapture = (id: string) => {
    const img = webcamRef.current?.getScreenshot({ quality: 0.5 }); // Kompres gambar ke 50%
    if (img && coords) sendToServer(img, coords.lat, coords.lng, id);
  };

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
        Swal.fire({ title: "Berhasil", text: "Absen Tercatat", icon: "success", timer: 1500 });
        router.push("/admin/dashboard");
      } else {
        throw new Error(data.message || "Ditolak Server");
      }
    } catch (e: any) {
      setIsProcessing(false);
      Swal.fire("Gagal Simpan", e.message, "error");
    }
  };

  // 3. GPS (Sederhana)
  const startAbsen = () => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setView("absen");
      },
      () => Swal.fire("GPS Mati", "Aktifkan Lokasi", "error"),
      { enableHighAccuracy: true }
    );
  };

  // ... (Tampilan UI Menu & Absen tetap sama seperti sebelumnya)
  return (
    // Copy bagian return UI dari kode sebelumnya di sini
    <div>UI Anda di sini...</div>
  );
}
