"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import * as faceapi from "face-api.js";

const DAFTAR_JABATAN = [
  "Kepala Sekolah",
  "Waksek Kurikulum",
  "Wakasek Kesiswaan",
  "Wakasek Humas",
  "Wakasek SarPras",
  "Kepala Perpustakaan",
  "Kepala Laboratorium",
  "Guru",
  "Pegawai TU",
  "Pegawai Perpustakaan",
  "Siswa",
];

export default function RegistrasiMandiriGuru() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const [formData, setFormData] = useState({
    kode_registrasi: "",
    nama_lengkap: "",
    nip: "",
    nuptk: "",
    jabatan: "Guru",
    jenjang: "SMP",
    foto_referensi: "",
    face_descriptor: "",
  });

  const refreshDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const devs = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devs.filter((d) => d.kind === "videoinput");

      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }

      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.error("Gagal mendeteksi kamera:", err);
    }
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setIsModelLoaded(true);
      } catch (err) {
        console.error("Gagal load model AI:", err);
      }
      await refreshDevices();
    };

    initApp();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);

    return () => {
      stopCamera();
      navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
    };
  }, []);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
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
          facingMode: selectedDeviceId ? undefined : "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      Swal.fire("Kamera Error", "Izinkan akses kamera pada browser Anda untuk mendaftar.", "error");
      setCameraActive(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (!isModelLoaded) {
      return Swal.fire("Tunggu Sebentar", "Sistem AI wajah sedang dimuat...", "info");
    }

    setIsCapturing(true);
    try {
      // Deteksi wajah sekaligus ekstrak 128-point face descriptor
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        return Swal.fire(
          "Wajah Tidak Terdeteksi",
          "Pastikan pencahayaan cukup, lepas masker/kacamata hitam, dan hadap lurus ke kamera.",
          "warning"
        );
      }

      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0);
      }

      const base64Image = canvas.toDataURL("image/jpeg", 0.85);
      const descriptorJson = JSON.stringify(Array.from(detection.descriptor));

      setCapturedImage(base64Image);
      setFormData((prev) => ({
        ...prev,
        foto_referensi: base64Image,
        face_descriptor: descriptorJson,
      }));

      stopCamera();
    } finally {
      setIsCapturing(false);
    }
  };

  const cleanOptional = (val: string) => {
    const t = val.trim();
    return t === "" || t === "-" ? null : t;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.kode_registrasi.trim()) {
      return Swal.fire("Kode Kosong", "Masukkan Kode Registrasi Sekolah dari Admin/TU.", "warning");
    }

    if (!formData.foto_referensi) {
      return Swal.fire("Foto Wajah Wajib", "Silakan ambil foto wajah biometrik Anda terlebih dahulu.", "warning");
    }

    setLoading(true);
    try {
      const payload = {
        kode_registrasi: formData.kode_registrasi.trim(),
        nama_lengkap: formData.nama_lengkap.trim(),
        nip: cleanOptional(formData.nip),
        nuptk: cleanOptional(formData.nuptk),
        jabatan: formData.jabatan,
        jenjang: formData.jenjang,
        foto_referensi: formData.foto_referensi,
        face_descriptor: formData.face_descriptor || null,
      };

      const res = await fetch("https://backendabsen.mejatika.com/api/registrasi-mandiri", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        stopCamera();
        await Swal.fire({
          title: "Pendaftaran Berhasil! 🎉",
          text: "Data dan wajah Anda telah terdaftar. Anda sekarang bisa langsung melakukan scan absensi.",
          icon: "success",
          confirmButtonColor: "#dc2626",
          confirmButtonText: "Ke Mesin Absensi",
        });
        router.push("/");
      } else {
        const errorDetail = result.errors
          ? Object.values(result.errors).flat().join("\n")
          : result.message || "Gagal mendaftar.";
        throw new Error(errorDetail);
      }
    } catch (error: any) {
      Swal.fire("Pendaftaran Gagal", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf5e6] bg-batik p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              router.push("/");
            }}
            className="text-slate-600 font-black text-xs uppercase flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl shadow-sm hover:text-red-600 transition"
          >
            ← Kembali ke Mesin Absen
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Portal Mandiri Pegawai
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* FORM BIODATA MANDIRI */}
          <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100">
            <div className="bg-red-600 p-8 text-white">
              <h1 className="text-2xl font-black uppercase tracking-tighter">Pendaftaran Mandiri</h1>
              <p className="text-red-100 text-[10px] font-bold uppercase tracking-widest mt-1">
                Registrasi Data & Wajah Guru / Pegawai Baru
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              {/* KODE AKSES SEKOLAH */}
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-1">
                <label className="text-[10px] font-black text-amber-700 uppercase ml-1 flex items-center gap-1">
                  🔑 Kode Registrasi Sekolah *
                </label>
                <input
                  required
                  value={formData.kode_registrasi}
                  placeholder="Masukkan kode dari Admin/TU..."
                  className="w-full p-3.5 bg-white rounded-xl border border-amber-200 font-black text-sm uppercase tracking-widest focus:ring-2 focus:ring-red-500 outline-none"
                  onChange={(e) => setFormData({ ...formData, kode_registrasi: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                  Nama Lengkap & Gelar *
                </label>
                <input
                  required
                  value={formData.nama_lengkap}
                  placeholder="Contoh: Yohanes Bosco, S.Pd"
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                    NIP <span className="text-slate-300 font-normal">(Opsional)</span>
                  </label>
                  <input
                    value={formData.nip}
                    placeholder="Kosongkan jika belum ada"
                    className="p-4 w-full bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm outline-none"
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                    NUPTK <span className="text-slate-300 font-normal">(Opsional)</span>
                  </label>
                  <input
                    value={formData.nuptk}
                    placeholder="Kosongkan jika belum ada"
                    className="p-4 w-full bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm outline-none"
                    onChange={(e) => setFormData({ ...formData, nuptk: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Unit / Jenjang *</label>
                  <select
                    required
                    value={formData.jenjang}
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                    onChange={(e) => setFormData({ ...formData, jenjang: e.target.value })}
                  >
                    <option value="SMP">SMP</option>
                    <option value="SMA">SMA</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Jabatan *</label>
                  <select
                    required
                    value={formData.jabatan}
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                    onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
                  >
                    {DAFTAR_JABATAN.map((jab) => (
                      <option key={jab} value={jab}>
                        {jab}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-5 rounded-2xl font-black text-white shadow-xl transition-all uppercase tracking-wider text-xs ${
                    loading ? "bg-slate-300" : "bg-red-600 hover:bg-red-700 active:scale-95"
                  }`}
                >
                  {loading ? "MEMPROSES PENDAFTARAN..." : "✅ DAFTAR & SIMPAN BIOMETRIK"}
                </button>
              </div>
            </form>
          </div>

          {/* BAGIAN REKAM WAJAH BIOMETRIK */}
          <div className="bg-white rounded-[40px] shadow-xl p-8 border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">Rekam Wajah Biometrik *</h2>
                <p className="text-[9px] text-red-600 font-bold uppercase mt-0.5">Wajib diambil untuk scan absensi</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-[9px] font-bold ${
                  isModelLoaded ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                }`}
              >
                {isModelLoaded ? "AI READY" : "AI LOADING..."}
              </span>
            </div>

            {devices.length > 1 && (
              <div className="mb-6 space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block">Pilih Kamera</label>
                <div className="flex gap-2">
                  <select
                    disabled={cameraActive}
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="flex-1 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none"
                  >
                    {devices.map((d, i) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Kamera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={refreshDevices}
                    className="p-3.5 bg-slate-100 rounded-2xl hover:bg-slate-200 transition"
                  >
                    🔄
                  </button>
                </div>
              </div>
            )}

            <div className="relative w-full aspect-square bg-slate-900 rounded-[30px] overflow-hidden shadow-inner border-4 border-slate-50">
              {cameraActive ? (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
              ) : capturedImage ? (
                <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 px-6 text-center">
                  <span className="text-5xl mb-3 opacity-30">🤳</span>
                  <p className="text-[11px] font-black uppercase opacity-70">Kamera Belum Aktif</p>
                  <p className="text-[9px] text-slate-400 mt-1">
                    Klik tombol di bawah, posisikan wajah di tengah layar, lalu ambil foto
                  </p>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="mt-6 space-y-3">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg"
                >
                  {capturedImage ? "📷 FOTO ULANG WAJAH" : "📷 AKTIFKAN KAMERA"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isCapturing}
                  onClick={capturePhoto}
                  className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg animate-pulse"
                >
                  {isCapturing ? "MEMPROSES WAJAH..." : "🎯 AMBIL SAMPEL WAJAH"}
                </button>
              )}

              {cameraActive && (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-full py-2 text-slate-400 font-bold text-[9px] uppercase hover:text-red-600 transition"
                >
                  Batalkan Kamera
                </button>
              )}
            </div>

            <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] text-slate-600 font-bold uppercase mb-1">Panduan Foto Biometrik:</p>
              <ul className="text-[9px] text-slate-500 space-y-1 list-disc list-inside">
                <li>Pastikan cahaya ruangan terang dan wajah tidak membelakangi lampu/jendela.</li>
                <li>Lepas masker, topi, atau kacamata hitam saat pengambilan foto.</li>
                <li>Jika kode registrasi salah, silakan tanyakan kode aktif kepada Admin / TU.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .bg-batik {
          background-image: url("https://www.transparenttextures.com/patterns/batik.png");
          background-attachment: fixed;
        }
      `}</style>
    </div>
  );
}
