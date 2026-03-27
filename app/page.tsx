"use client";
import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

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
  
  // OPTIMASI 1: Meningkatkan Resolusi Video untuk Detail Wajah Lebih Baik
  const videoConstraints = { 
    width: 720, 
    height: 1280, 
    facingMode: "user",
    aspectRatio: 9/16 
  };

  useEffect(() => {
    const loadSistem = async () => {
      try {
        const [configRes, gurus] = await Promise.all([
          api.getSettings(),
          api.getGuruReferensi()
        ]);

        if (configRes.success) setConfig(configRes.data);

        const MODEL_URL = "/models";
        // OPTIMASI 2: Menggunakan SSD Mobilenet V1 untuk Referensi (Jauh lebih akurat dari TinyFace)
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        const labeledDescriptors = await Promise.all(
          gurus.map(async (guru) => {
            if (!guru.foto_referensi) return null;
            try {
              const imgUrl = `https://projeckkelasxi.mejatika.com/storage/${guru.foto_referensi}`;
              const img = await faceapi.fetchImage(imgUrl);
              
              // Gunakan SSD Mobilenet untuk ekstraksi fitur referensi agar sangat presisi
              const fullDesc = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();
                
              return fullDesc ? new faceapi.LabeledFaceDescriptors(guru.id.toString(), [fullDesc.descriptor]) : null;
            } catch (e) { return null; }
          })
        );

        const validDescriptors = labeledDescriptors.filter(d => d !== null);
        if (validDescriptors.length > 0) {
          // OPTIMASI 3: Distance Threshold diturunkan (0.4 - 0.5) agar lebih ketat/akurat
          // Semakin kecil angka (misal 0.45), semakin sulit dipalsukan tapi butuh cahaya bagus.
          setFaceMatcher(new faceapi.FaceMatcher(validDescriptors, 0.45)); 
          if (view === "menu") setPesan("⚡ Scanner Siap");
        }
      } catch (err) { 
        setPesan("Gagal memuat sistem");
        console.error(err);
      }
    };
    loadSistem();
    
    // Geolocation tetap sama...
    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("GPS Error:", err), 
        { enableHighAccuracy: true }
      );
    }
  }, []);

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

          // OPTIMASI 4: Meningkatkan inputSize TinyFaceDetector ke 224 atau 320 untuk akurasi deteksi jarak jauh
          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          const ctx = canvas.getContext("2d");
          ctx?.clearRect(0, 0, canvas.width, canvas.height);

          if (detection) {
            const { width } = detection.detection.box;
            // Menyesuaikan ambang batas ukuran wajah berdasarkan resolusi baru
            if (width >= 120 && width <= 450) {
              setScanStatus("locked");
              setPesan("Wajah Terkunci... Mohon Diam");
              
              if (faceMatcher && !isLocked.current) {
                const match = faceMatcher.findBestMatch(detection.descriptor);
                
                // OPTIMASI 5: Hanya menerima jika label bukan unknown
                if (match.label !== "unknown") {
                  isLocked.current = true; 
                  setIsProcessing(true);
                  setScanStatus("success");
                  clearInterval(scanIntervalRef.current); 
                  setPesan("Verifikasi Berhasil...");
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
      }, 200); // Sedikit diperlambat agar CPU tidak overheat saat memproses resolusi tinggi
    }
    return () => clearInterval(scanIntervalRef.current);
  }, [view, faceMatcher, isProcessing]);

  // handleRecognitionSuccess & sendToServer tetap menggunakan library api.js Anda
  // ... (Sisanya sama seperti kode sebelumnya)
