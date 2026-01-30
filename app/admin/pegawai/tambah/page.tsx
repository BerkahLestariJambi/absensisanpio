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
    foto_referensi: ""
  });

  // 1. Load Face API Models - Pastikan folder /public/models sudah ada file-filenya
  useEffect(() => {
    const loadModels = async () => {
      try {
        // Gunakan path absolut yang benar
        const MODEL_URL = "/models"; 
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        
        console.log("Models Loaded Successfully");
        setIsModelLoaded(true);
      } catch (err) {
        console.error("Gagal load model face-api:", err);
        // Tetap set true agar tombol tidak terkunci jika model gagal (opsional untuk debug)
        // setIsModelLoaded(true); 
      }
    };
    loadModels();
  }, []);

  const startCamera = async () => {
    setCameraActive(true);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Kamera Error", "Pastikan izin kamera diaktifkan", "error");
      setCameraActive(false);
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      try {
        // Tampilkan loading sebentar saat proses deteksi
        const detection = await faceapi.detectSingleFace(
          videoRef.current, 
          new faceapi.TinyFaceDetectorOptions()
        );
        
        if (!detection) {
          return Swal.fire("Wajah Tidak Terdeteksi", "Posisikan wajah tepat di depan kamera", "warning");
        }

        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
        
        const base64Image = canvas.toDataURL("image/jpeg");
        setCapturedImage(base64Image);
        setFormData(prev => ({ ...prev, foto_referensi: base64Image }));
        
        // Stop Kamera
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        setCameraActive(false);
      } catch (error) {
        console.error("Capture error:", error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submit ditekan..."); // Untuk debug

    if (!formData.foto_referensi) {
      return Swal.fire("Foto Belum Ada", "Harap ambil foto biometrik terlebih dahulu", "warning");
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      
      const res = await fetch("https://backendabsen.mejatika.com/api/admin/guru/manual", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      console.log("Server Response:", result);

      if (res.ok) {
        await Swal.fire("Berhasil", "Pegawai & Biometrik terdaftar!", "success");
        router.push("/admin/dashboard");
      } else {
        throw new Error(result.message || "Gagal menyimpan ke server");
      }
    } catch (error: any) {
      console.error("Submit error:", error);
      Swal.fire("Gagal", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf5e6] p-6">
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Form Data */}
        <div className="bg-white rounded-[30px] shadow-xl overflow-hidden">
          <div className="bg-slate-800 p-6 text-white uppercase font-black text-center">Data Pegawai</div>
          <form onSubmit={handleSubmit} className="p-8 space-y-4">
            <input required placeholder="Nama Lengkap" className="w-full p-4 bg-slate-50 rounded-2xl border" 
              onChange={(e) => setFormData({...formData, nama_lengkap: e.target.value})} />
            
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="NIP" className="p-4 bg-slate-50 rounded-2xl border" 
                onChange={(e) => setFormData({...formData, nip: e.target.value})} />
              <input placeholder="NUPTK" className="p-4 bg-slate-50 rounded-2xl border" 
                onChange={(e) => setFormData({...formData, nuptk: e.target.value})} />
            </div>

            <select required className="w-full p-4 bg-slate-50 rounded-2xl border" 
              onChange={(e) => setFormData({...formData, jenjang: e.target.value})}>
              <option value="SMP">SMP</option>
              <option value="SMA">SMA</option>
            </select>

            <input required placeholder="Jabatan" className="w-full p-4 bg-slate-50 rounded-2xl border" 
              onChange={(e) => setFormData({...formData, jabatan: e.target.value})} />
            
            {/* Indikator Model */}
            {!isModelLoaded && <p className="text-xs text-orange-500 animate-pulse">⏳ Memuat AI Kamera (Face-API)...</p>}

            <button 
              type="submit" 
              disabled={loading} 
              className={`w-full py-4 rounded-2xl font-black text-white shadow-lg transition-all ${
                loading ? "bg-slate-400" : "bg-red-600 hover:bg-red-700 active:scale-95"
              }`}
            >
              {loading ? "SEDANG MENGIRIM..." : "💾 SIMPAN LENGKAP"}
            </button>
          </form>
        </div>

        {/* Biometrik */}
        <div className="bg-white rounded-[30px] shadow-xl p-8 flex flex-col items-center border-2 border-dashed border-slate-200">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Rekam Biometrik</h3>
          
          <div className="relative w-full aspect-square bg-slate-900 rounded-[40px] overflow-hidden border-8 border-white shadow-inner">
            {cameraActive ? (
              <video ref={videoRef} autoPlay muted className="w-full h-full object-cover -scale-x-100" />
            ) : capturedImage ? (
              <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <span className="text-5xl mb-2">👤</span>
                <p className="text-[10px] font-bold uppercase">Kamera Belum Aktif</p>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="mt-8 w-full space-y-3">
            {!cameraActive ? (
              <button type="button" onClick={startCamera} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-md">
                📷 {capturedImage ? "ULANGI FOTO" : "AKTIFKAN KAMERA"}
              </button>
            ) : (
              <button type="button" onClick={capturePhoto} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-xs uppercase shadow-md">
                🎯 AMBIL SAMPEL WAJAH
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
