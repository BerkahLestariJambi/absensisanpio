"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import * as faceapi from "face-api.js";

export default function TambahPegawai() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  const [formData, setFormData] = useState({
    nama_lengkap: "",
    nip: "",
    nuptk: "",
    jabatan: "",
    jenjang: "SMP",
    foto_referensi: "" // Field tambahan untuk biometrik
  });

  // 1. Load Face API Models dari /public/models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);
        setIsModelLoaded(true);
      } catch (err) {
        console.error("Gagal load model face-api", err);
      }
    };
    loadModels();
  }, []);

  // 2. Akses Kamera
  const startCamera = async () => {
    setCameraActive(true);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      Swal.fire("Kamera Error", "Gagal mengakses kamera", "error");
    }
  };

  // 3. Ambil Foto & Validasi Wajah
  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Deteksi apakah ada wajah sebelum capture
      const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
      
      if (!detection) {
        return Swal.fire("Wajah Tidak Terdeteksi", "Pastikan wajah terlihat jelas di kamera", "warning");
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      
      const base64Image = canvas.toDataURL("image/jpeg");
      setCapturedImage(base64Image);
      setFormData({ ...formData, foto_referensi: base64Image });
      
      // Matikan kamera
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capturedImage) return Swal.fire("Foto Belum Ada", "Rekam biometrik wajah pegawai dulu", "warning");

    setLoading(true);
    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/admin/guru", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}` 
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        Swal.fire("Berhasil", "Pegawai & Biometrik terdaftar!", "success");
        router.push("/admin/dashboard");
      }
    } catch (error) {
      Swal.fire("Error", "Gagal menghubungi server", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf5e6] bg-batik p-6">
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Kolom 1: Form Data */}
        <div className="bg-white rounded-[30px] shadow-xl overflow-hidden h-fit">
          <div className="bg-slate-800 p-6 text-white uppercase font-black text-center tracking-widest">Data Pegawai</div>
          <form onSubmit={handleSubmit} className="p-8 space-y-4">
            <input required placeholder="Nama Lengkap" className="w-full p-4 bg-slate-50 rounded-2xl border outline-none focus:ring-2 focus:ring-red-500 font-bold" onChange={(e) => setFormData({...formData, nama_lengkap: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="NIP" className="p-4 bg-slate-50 rounded-2xl border outline-none focus:ring-2 focus:ring-red-500 font-mono" onChange={(e) => setFormData({...formData, nip: e.target.value})} />
              <input placeholder="NUPTK" className="p-4 bg-slate-50 rounded-2xl border outline-none focus:ring-2 focus:ring-red-500 font-mono" onChange={(e) => setFormData({...formData, nuptk: e.target.value})} />
            </div>
            <select required className="w-full p-4 bg-slate-50 rounded-2xl border outline-none focus:ring-2 focus:ring-red-500 font-bold" onChange={(e) => setFormData({...formData, jenjang: e.target.value})}>
              <option value="SMP">SMP</option>
              <option value="SMA">SMA</option>
            </select>
            <input required placeholder="Jabatan" className="w-full p-4 bg-slate-50 rounded-2xl border outline-none focus:ring-2 focus:ring-red-500 font-bold" onChange={(e) => setFormData({...formData, jabatan: e.target.value})} />
            
            <button type="submit" disabled={loading || !isModelLoaded} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black tracking-widest hover:bg-red-700 shadow-lg transition-all">
              {loading ? "PROSES..." : "💾 SIMPAN LENGKAP"}
            </button>
          </form>
        </div>

        {/* Kolom 2: Biometrik */}
        <div className="bg-white rounded-[30px] shadow-xl overflow-hidden flex flex-col items-center p-8 border-2 border-dashed border-slate-200">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Rekam Biometrik</h3>
          
          <div className="relative w-full aspect-square bg-slate-900 rounded-[40px] overflow-hidden shadow-inner border-8 border-white">
            {cameraActive ? (
              <video ref={videoRef} autoPlay muted className="w-full h-full object-cover -scale-x-100" />
            ) : capturedImage ? (
              <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 p-10 text-center">
                <span className="text-5xl mb-4">👤</span>
                <p className="text-xs font-bold uppercase leading-relaxed">Kamera Belum Aktif</p>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="mt-8 w-full">
            {!cameraActive ? (
              <button onClick={startCamera} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs tracking-[0.2em] shadow-lg shadow-blue-100 uppercase transition-all active:scale-95">
                📷 {capturedImage ? "ULANGI AMBIL FOTO" : "AKTIFKAN KAMERA"}
              </button>
            ) : (
              <button onClick={capturePhoto} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-xs tracking-[0.2em] shadow-lg shadow-green-100 uppercase transition-all active:scale-95">
                🎯 AMBIL SAMPEL WAJAH
              </button>
            )}
            <p className="text-[10px] text-slate-400 font-medium text-center mt-4 italic">
              *Pastikan pencahayaan cukup dan wajah tidak tertutup masker/kacamata hitam.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
