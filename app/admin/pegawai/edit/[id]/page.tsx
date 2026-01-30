"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Swal from "sweetalert2";
import * as faceapi from "face-api.js";

export default function EditPegawai() {
  const router = useRouter();
  const { id } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  const [formData, setFormData] = useState({
    nama_lengkap: "",
    nip: "",
    nuptk: "",
    jabatan: "",
    jenjang: "SMP",
    foto_referensi: "" // Kosongkan jika tidak ingin update foto
  });
  
  const [oldPhoto, setOldPhoto] = useState<string | null>(null);

  // 1. Load Data Lama & Model Face-API
  useEffect(() => {
    const initPage = async () => {
      try {
        // Load Models
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);
        setIsModelLoaded(true);

        // Fetch Data Pegawai
        const res = await fetch(`https://backendabsen.mejatika.com/api/admin/guru/${id}`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("auth_token")}` }
        });
        const data = await res.json();
        
        setFormData({
          nama_lengkap: data.nama_lengkap,
          nip: data.nip || "",
          nuptk: data.nuptk || "",
          jabatan: data.jabatan || "",
          jenjang: data.jenjang,
          foto_referensi: "" 
        });
        setOldPhoto(data.foto_referensi); // Path dari backend
      } catch (err) {
        Swal.fire("Error", "Gagal memuat data pegawai", "error");
      } finally {
        setLoading(false);
      }
    };
    initPage();
  }, [id]);

  // 2. Logika Kamera (Sama dengan Tambah Pegawai)
  const startCamera = async () => {
    setCameraActive(true);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      Swal.fire("Kamera Error", "Gagal mengakses kamera", "error");
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions());
      if (!detection) return Swal.fire("Wajah Tidak Terdeteksi", "Pastikan wajah terlihat jelas", "warning");

      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
      
      const base64Image = canvas.toDataURL("image/jpeg");
      setCapturedImage(base64Image);
      setFormData({ ...formData, foto_referensi: base64Image });
      
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const res = await fetch(`https://backendabsen.mejatika.com/api/admin/guru/${id}`, {
        method: "PUT", // Gunakan PUT atau POST dengan _method=PUT
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}` 
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        Swal.fire("Berhasil", "Data & Biometrik telah diperbarui", "success");
        router.push("/admin/pegawai");
      }
    } catch (error) {
      Swal.fire("Error", "Gagal update data", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div className="p-10 text-center font-bold animate-pulse">Memuat Data...</div>;

  return (
    <div className="min-h-screen bg-[#fdf5e6] bg-batik p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-md text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Update Profil Pegawai</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Data */}
          <div className="bg-white rounded-[30px] shadow-xl overflow-hidden">
            <div className="bg-red-600 p-6 text-white text-center font-black tracking-widest uppercase">Informasi Dasar</div>
            <form onSubmit={handleUpdate} className="p-8 space-y-4">
              <input required value={formData.nama_lengkap} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" onChange={(e) => setFormData({...formData, nama_lengkap: e.target.value})} placeholder="Nama Lengkap" />
              <input value={formData.nip} className="w-full p-4 bg-slate-50 border rounded-2xl font-mono" onChange={(e) => setFormData({...formData, nip: e.target.value})} placeholder="NIP" />
              <input value={formData.nuptk} className="w-full p-4 bg-slate-50 border rounded-2xl font-mono" onChange={(e) => setFormData({...formData, nuptk: e.target.value})} placeholder="NUPTK" />
              <select value={formData.jenjang} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" onChange={(e) => setFormData({...formData, jenjang: e.target.value})}>
                <option value="SMP">SMP</option>
                <option value="SMA">SMA</option>
              </select>
              <input required value={formData.jabatan} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" onChange={(e) => setFormData({...formData, jabatan: e.target.value})} placeholder="Jabatan" />
              
              <button type="submit" disabled={isUpdating} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black tracking-widest hover:bg-slate-900 shadow-lg transition-all">
                {isUpdating ? "MENYIMPAN..." : "🔄 PERBARUI DATA"}
              </button>
            </form>
          </div>

          {/* Biometrik Update */}
          <div className="bg-white rounded-[30px] shadow-xl p-8 flex flex-col items-center">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 text-center">Update Biometrik Wajah</h3>
            
            <div className="relative w-full aspect-square bg-slate-900 rounded-[40px] overflow-hidden border-8 border-slate-50 shadow-inner">
              {cameraActive ? (
                <video ref={videoRef} autoPlay muted className="w-full h-full object-cover -scale-x-100" />
              ) : capturedImage ? (
                <img src={capturedImage} className="w-full h-full object-cover" alt="New" />
              ) : (
                <div className="relative h-full">
                  <img src={`https://backendabsen.mejatika.com/storage/${oldPhoto}`} className="w-full h-full object-cover opacity-50" alt="Old" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-black/50 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-tighter">Wajah Saat Ini</span>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <button onClick={startCamera} className="mt-6 w-full py-4 border-2 border-red-600 text-red-600 rounded-2xl font-black text-xs tracking-widest hover:bg-red-50 transition-all">
              📷 {capturedImage ? "AMBIL ULANG FOTO" : "UPDATE SCAN WAJAH"}
            </button>
            {cameraActive && (
              <button onClick={capturePhoto} className="mt-2 w-full py-4 bg-green-600 text-white rounded-2xl font-black text-xs tracking-widest shadow-lg shadow-green-100">
                🎯 KUNCI WAJAH BARU
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
