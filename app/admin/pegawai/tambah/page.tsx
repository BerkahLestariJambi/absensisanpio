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

  // --- STATE PERANGKAT KAMERA ---
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const [formData, setFormData] = useState({
    nama_lengkap: "",
    nip: "",
    nuptk: "",
    jabatan: "",
    jenjang: "SMP",
    foto_referensi: ""
  });

  // 1. Inisialisasi Model & List Kamera
  useEffect(() => {
    const initApp = async () => {
      try {
        const MODEL_URL = "/models"; 
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setIsModelLoaded(true);
      } catch (err) {
        console.error("Gagal load model AI:", err);
      }

      try {
        // Minta izin akses kamera agar label perangkat terbaca
        const initialStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const devs = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devs.filter(d => d.kind === "videoinput");
        setDevices(videoDevices);
        
        if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
        
        // Langsung matikan stream inisialisasi agar lampu kamera tidak terus nyala
        initialStream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error("Gagal akses daftar kamera:", err);
      }
    };
    initApp();

    // Cleanup saat komponen ditutup (Unmount)
    return () => stopCamera();
  }, []);

  // Fungsi Berhenti Kamera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCapturedImage(null);
    setCameraActive(true);
    
    try {
      const constraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Gagal menyambungkan ke kamera pilihan.", "error");
      setCameraActive(false);
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
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
      
      const base64Image = canvas.toDataURL("image/jpeg", 0.8); // Kompresi 80% agar tidak terlalu berat
      setCapturedImage(base64Image);
      setFormData(prev => ({ ...prev, foto_referensi: base64Image }));
      
      stopCamera(); // Langsung matikan kamera setelah dapet foto
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.foto_referensi) return Swal.fire("Foto Kosong", "Ambil foto wajah dulu!", "warning");

    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("https://backendabsen.mejatika.com/api/admin/guru/manual", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        stopCamera(); // Pastikan kamera mati total
        await Swal.fire({
          title: "Berhasil!",
          text: "Data pegawai dan biometrik telah disimpan.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false
        });
        router.push("/admin/dashboard"); // Langsung tutup halaman (kembali ke dashboard)
      } else {
        const result = await res.json();
        throw new Error(result.message || "Gagal simpan.");
      }
    } catch (error: any) {
      Swal.fire("Gagal", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf5e6] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Tombol Kembali */}
        <button onClick={() => { stopCamera(); router.back(); }} className="mb-6 text-slate-500 font-bold text-xs uppercase flex items-center gap-2 hover:text-red-600 transition">
          ← Kembali ke Dashboard
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* FORM DATA */}
          <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100">
            <div className="bg-red-600 p-8 text-white">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Tambah Pegawai</h2>
              <p className="text-red-100 text-[10px] font-bold uppercase tracking-widest mt-1">Input Data & Registrasi Wajah</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nama Lengkap</label>
                <input required placeholder="Contoh: Budi Santoso, S.Pd" className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-red-600 font-bold text-sm" 
                  onChange={(e) => setFormData({...formData, nama_lengkap: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">NIP</label>
                  <input placeholder="Opsional" className="p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-red-600 font-bold text-sm" 
                    onChange={(e) => setFormData({...formData, nip: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">NUPTK</label>
                  <input placeholder="Opsional" className="p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-red-600 font-bold text-sm" 
                    onChange={(e) => setFormData({...formData, nuptk: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Jenjang Sekolah</label>
                  <select required className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-red-600 font-bold text-sm" 
                    onChange={(e) => setFormData({...formData, jenjang: e.target.value})}>
                    <option value="SMP">SMP</option>
                    <option value="SMA">SMA</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Jabatan</label>
                  <input required placeholder="Guru Mapel" className="p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-red-600 font-bold text-sm" 
                    onChange={(e) => setFormData({...formData, jabatan: e.target.value})} />
                </div>
              </div>

              <div className="pt-4">
                {!isModelLoaded ? (
                  <div className="text-center p-4 bg-amber-50 rounded-2xl text-amber-600 text-[10px] font-bold animate-pulse">
                    ⏳ MENYIAPKAN AI WAJAH...
                  </div>
                ) : (
                  <button type="submit" disabled={loading} 
                    className={`w-full py-5 rounded-2xl font-black text-white shadow-xl shadow-red-100 transition-all ${loading ? "bg-slate-400" : "bg-red-600 hover:bg-red-700 active:scale-95"}`}>
                    {loading ? "PROSES MENYIMPAN..." : "💾 SIMPAN & SELESAI"}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* KAMERA SECTION */}
          <div className="bg-white rounded-[40px] shadow-xl p-8 border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Input Biometrik</h3>
              <div className={`w-3 h-3 rounded-full ${isModelLoaded ? 'bg-green-500' : 'bg-red-500'} animate-ping`}></div>
            </div>

            {/* Selector Perangkat */}
            <div className="mb-6 space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Pilih Sumber Kamera (USB/Wireless)</label>
              <select 
                disabled={cameraActive}
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-red-600"
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i+1}`}</option>
                ))}
              </select>
            </div>

            {/* Area Video */}
            <div className="relative w-full aspect-square bg-slate-900 rounded-[30px] overflow-hidden shadow-inner border-4 border-slate-50">
              {cameraActive ? (
                <video ref={videoRef} autoPlay muted className="w-full h-full object-cover -scale-x-100" />
              ) : capturedImage ? (
                <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 italic">
                  <span className="text-4xl mb-3">📸</span>
                  <p className="text-[10px] font-bold uppercase">Kamera Siap</p>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="mt-8 space-y-3">
              {!cameraActive ? (
                <button type="button" onClick={startCamera} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition shadow-lg">
                  {capturedImage ? "🔄 Ganti Foto" : "📸 Aktifkan Kamera"}
                </button>
              ) : (
                <button type="button" onClick={capturePhoto} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-700 transition shadow-lg animate-bounce">
                  🎯 Ambil Sample Wajah
                </button>
              )}
              
              {cameraActive && (
                <button type="button" onClick={stopCamera} className="w-full py-2 text-slate-400 font-bold text-[9px] uppercase hover:text-red-600">
                  Batalkan Kamera
                </button>
              )}
            </div>
            
            <p className="mt-6 text-[9px] text-slate-300 font-medium text-center">
              *Pastikan pencahayaan cukup dan wajah tidak tertutup masker/kacamata hitam.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
