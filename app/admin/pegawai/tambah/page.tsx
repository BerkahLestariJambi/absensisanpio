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

  // 1. Fungsi untuk Mengambil Daftar Kamera
  const refreshDevices = async () => {
    try {
      // Minta izin akses agar label perangkat (nama kamera) muncul
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const devs = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devs.filter(d => d.kind === "videoinput");
      
      setDevices(videoDevices);
      
      // Jika belum ada yang dipilih, pilih yang pertama
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }

      // Matikan stream sementara setelah dapet list
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Gagal mendeteksi kamera:", err);
    }
  };

  // 2. Inisialisasi Model & Monitoring USB
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
      await refreshDevices();
    };

    initApp();

    // Listener otomatis jika USB dicolok/cabut
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);

    return () => {
      stopCamera();
      navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
    };
  }, []);

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
      Swal.fire("Error", "Kamera tidak merespon. Cek koneksi USB atau izin browser.", "error");
      setCameraActive(false);
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      // Deteksi wajah sebelum capture
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
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Mirroring balik saat simpan
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0);
      }
      
      const base64Image = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedImage(base64Image);
      setFormData(prev => ({ ...prev, foto_referensi: base64Image }));
      
      stopCamera();
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
        stopCamera();
        await Swal.fire({
          title: "Berhasil!",
          text: "Pegawai baru telah terdaftar.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false
        });
        router.push("/admin/dashboard");
      } else {
        const result = await res.json();
        throw new Error(result.message || "Gagal simpan ke server.");
      }
    } catch (error: any) {
      Swal.fire("Gagal", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf5e6] p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => { stopCamera(); router.back(); }} className="mb-6 text-slate-500 font-bold text-xs uppercase flex items-center gap-2 hover:text-red-600 transition">
          ← Kembali
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* BAGIAN FORM DATA */}
          <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100">
            <div className="bg-red-600 p-8 text-white">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Registrasi Pegawai</h2>
              <p className="text-red-100 text-[10px] font-bold uppercase tracking-widest mt-1">Input Data & Biometrik</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nama Lengkap</label>
                <input required placeholder="Nama Lengkap..." className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none" 
                  onChange={(e) => setFormData({...formData, nama_lengkap: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">NIP</label>
                  <input placeholder="NIP..." className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm outline-none" 
                    onChange={(e) => setFormData({...formData, nip: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">NUPTK</label>
                  <input placeholder="NUPTK..." className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm outline-none" 
                    onChange={(e) => setFormData({...formData, nuptk: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Jenjang</label>
                  <select required className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm outline-none" 
                    onChange={(e) => setFormData({...formData, jenjang: e.target.value})}>
                    <option value="SMP">SMP</option>
                    <option value="SMA">SMA</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Jabatan</label>
                  <input required placeholder="Jabatan..." className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm outline-none" 
                    onChange={(e) => setFormData({...formData, jabatan: e.target.value})} />
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" disabled={loading || !isModelLoaded} 
                  className={`w-full py-5 rounded-2xl font-black text-white shadow-xl transition-all ${loading || !isModelLoaded ? "bg-slate-300" : "bg-red-600 hover:bg-red-700 active:scale-95"}`}>
                  {loading ? "MENYIMPAN..." : "💾 SIMPAN DATA"}
                </button>
              </div>
            </form>
          </div>

          {/* BAGIAN KAMERA */}
          <div className="bg-white rounded-[40px] shadow-xl p-8 border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Input Biometrik</h3>
              <span className={`px-3 py-1 rounded-full text-[9px] font-bold ${isModelLoaded ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {isModelLoaded ? 'AI READY' : 'AI LOADING...'}
              </span>
            </div>

            <div className="mb-6 space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block">Sumber Kamera (USB / HP / Built-in)</label>
              <div className="flex gap-2">
                <select 
                  disabled={cameraActive}
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-red-500"
                >
                  {devices.length === 0 && <option>Mencari perangkat...</option>}
                  {devices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i+1}`}</option>
                  ))}
                </select>
                <button type="button" onClick={refreshDevices} className="p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition" title="Refresh list kamera">
                  🔄
                </button>
              </div>
            </div>

            <div className="relative w-full aspect-square bg-slate-900 rounded-[30px] overflow-hidden shadow-inner border-4 border-slate-50">
              {cameraActive ? (
                <video ref={videoRef} autoPlay muted className="w-full h-full object-cover -scale-x-100" />
              ) : capturedImage ? (
                <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-600">
                  <span className="text-4xl mb-3 opacity-20">📸</span>
                  <p className="text-[10px] font-bold uppercase opacity-40">Kamera Belum Aktif</p>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="mt-8 space-y-3">
              {!cameraActive ? (
                <button type="button" onClick={startCamera} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200">
                  {capturedImage ? "📷 ULANGI FOTO" : "📷 AKTIFKAN KAMERA"}
                </button>
              ) : (
                <button type="button" onClick={capturePhoto} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-100 animate-pulse">
                  🎯 AMBIL SAMPEL WAJAH
                </button>
              )}
              
              {cameraActive && (
                <button type="button" onClick={stopCamera} className="w-full py-2 text-slate-400 font-bold text-[9px] uppercase hover:text-red-600 transition">
                  Batalkan
                </button>
              )}
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-[9px] text-blue-600 font-bold uppercase mb-1">Tips USB:</p>
              <p className="text-[9px] text-blue-500 leading-relaxed">
                Jika kamera HP tidak terdeteksi, pastikan aplikasi **DroidCam** atau **Iriun** sudah terbuka di PC dan HP Anda sudah dalam mode **USB Debugging**.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
