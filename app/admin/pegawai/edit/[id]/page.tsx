"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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

  // --- STATE PERANGKAT KAMERA ---
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const [formData, setFormData] = useState({
    nama_lengkap: "",
    nip: "",
    nuptk: "",
    jabatan: "Guru",
    jenjang: "SMP",
    foto_referensi: "", // Kosongkan jika tidak ingin update foto
  });

  const [oldPhoto, setOldPhoto] = useState<string | null>(null);

  // 1. Fungsi untuk Mengambil Daftar Kamera
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

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // 2. Load Data Lama, Model Face-API & Monitoring USB
  useEffect(() => {
    const initPage = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);
        setIsModelLoaded(true);
      } catch (err) {
        console.error("Gagal load model AI:", err);
      }

      try {
        const res = await fetch(`https://backendabsen.mejatika.com/api/admin/guru/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            Accept: "application/json",
          },
        });
        const data = await res.json();

        setFormData({
          nama_lengkap: data.nama_lengkap || "",
          nip: data.nip || "",
          nuptk: data.nuptk || "",
          jabatan: data.jabatan || "Guru",
          jenjang: data.jenjang || "SMP",
          foto_referensi: "",
        });
        setOldPhoto(data.foto_referensi || null);
      } catch (err) {
        Swal.fire("Error", "Gagal memuat data pegawai", "error");
      } finally {
        setLoading(false);
      }

      await refreshDevices();
    };

    initPage();

    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);

    return () => {
      stopCamera();
      navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
    };
  }, [id]);

  // 3. Logika Kamera (Sama dengan Tambah Pegawai)
  const startCamera = async () => {
    setCapturedImage(null);
    setCameraActive(true);

    try {
      const constraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Kamera Error", "Kamera tidak merespon. Cek koneksi USB atau izin browser.", "error");
      setCameraActive(false);
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      if (!isModelLoaded) {
        return Swal.fire("Tunggu Sebentar", "Model AI pendeteksi wajah sedang dimuat...", "info");
      }

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
        // Mirroring balik saat simpan agar hasil foto sesuai tampilan layar
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0);
      }

      const base64Image = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedImage(base64Image);
      setFormData((prev) => ({ ...prev, foto_referensi: base64Image }));

      stopCamera();
    }
  };

  const cleanOptional = (val: string) => {
    const t = val.trim();
    return t === "" || t === "-" ? null : t;
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const payload: any = {
        nama_lengkap: formData.nama_lengkap.trim(),
        nip: cleanOptional(formData.nip),
        nuptk: cleanOptional(formData.nuptk),
        jabatan: formData.jabatan,
        jenjang: formData.jenjang,
        foto_referensi: formData.foto_referensi || null,
      };

      const res = await fetch(`https://backendabsen.mejatika.com/api/admin/guru/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        stopCamera();
        await Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: "Data & Biometrik telah diperbarui",
          timer: 1500,
          showConfirmButton: false,
        });
        router.push("/admin/dashboard?tab=guru");
      } else {
        Swal.fire("Gagal", result.message || "Gagal memperbarui data", "error");
      }
    } catch (error) {
      Swal.fire("Error", "Gagal menghubungi server", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div className="p-10 text-center font-bold animate-pulse">Memuat Data...</div>;

  return (
    <div className="min-h-screen bg-[#fdf5e6] bg-batik p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              router.push("/admin/dashboard?tab=guru");
            }}
            className="p-2.5 bg-white rounded-full shadow-md text-red-600 hover:bg-red-50 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Update Profil Pegawai</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Form Data */}
          <div className="bg-white rounded-[40px] shadow-xl overflow-hidden border border-slate-100">
            <div className="bg-red-600 p-8 text-white">
              <h2 className="text-xl font-black uppercase tracking-tighter">Informasi Dasar</h2>
              <p className="text-red-100 text-[10px] font-bold uppercase tracking-widest mt-1">
                Perbarui Identitas Pegawai
              </p>
            </div>

            <form onSubmit={handleUpdate} className="p-8 space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nama Lengkap *</label>
                <input
                  required
                  value={formData.nama_lengkap}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                  placeholder="Nama Lengkap"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                    NIP <span className="text-slate-300 font-normal">(Opsional)</span>
                  </label>
                  <input
                    value={formData.nip}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono text-sm outline-none"
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                    placeholder="Kosongkan jika tidak ada"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">
                    NUPTK <span className="text-slate-300 font-normal">(Opsional)</span>
                  </label>
                  <input
                    value={formData.nuptk}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono text-sm outline-none"
                    onChange={(e) => setFormData({ ...formData, nuptk: e.target.value })}
                    placeholder="Kosongkan jika tidak ada"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Jenjang *</label>
                  <select
                    required
                    value={formData.jenjang}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
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
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                    onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
                  >
                    {!DAFTAR_JABATAN.includes(formData.jabatan) && formData.jabatan && (
                      <option value={formData.jabatan}>{formData.jabatan}</option>
                    )}
                    {DAFTAR_JABATAN.map((jab) => (
                      <option key={jab} value={jab}>
                        {jab}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className={`w-full py-5 rounded-2xl font-black text-white tracking-widest shadow-xl transition-all ${
                    isUpdating ? "bg-slate-300" : "bg-slate-800 hover:bg-slate-900 active:scale-95"
                  }`}
                >
                  {isUpdating ? "MENYIMPAN..." : "🔄 PERBARUI DATA"}
                </button>
              </div>
            </form>
          </div>

          {/* Biometrik Update + Setingan Kamera */}
          <div className="bg-white rounded-[40px] shadow-xl p-8 border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Update Biometrik Wajah</h3>
                <p className="text-[9px] text-amber-600 font-bold uppercase mt-0.5">
                  Biarkan jika tidak ingin mengganti foto
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-[9px] font-bold ${
                  isModelLoaded ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                }`}
              >
                {isModelLoaded ? "AI READY" : "AI LOADING..."}
              </span>
            </div>

            {/* Pilihan Sumber Kamera USB / HP / Built-in */}
            <div className="mb-6 space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block">
                Sumber Kamera (USB / HP / Built-in)
              </label>
              <div className="flex gap-2">
                <select
                  disabled={cameraActive}
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-red-500"
                >
                  {devices.length === 0 && <option>Mencari perangkat...</option>}
                  {devices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={refreshDevices}
                  className="p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition"
                  title="Refresh list kamera"
                >
                  🔄
                </button>
              </div>
            </div>

            <div className="relative w-full aspect-square bg-slate-900 rounded-[30px] overflow-hidden border-4 border-slate-50 shadow-inner">
              {cameraActive ? (
                <video ref={videoRef} autoPlay muted className="w-full h-full object-cover -scale-x-100" />
              ) : capturedImage ? (
                <img src={capturedImage} className="w-full h-full object-cover" alt="New" />
              ) : oldPhoto ? (
                <div className="relative h-full">
                  <img
                    src={`https://backendabsen.mejatika.com/storage/${oldPhoto}`}
                    className="w-full h-full object-cover opacity-60"
                    alt="Old"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-black/60 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-tighter">
                      Wajah Saat Ini
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 px-6 text-center">
                  <span className="text-4xl mb-3 opacity-30">📸</span>
                  <p className="text-[10px] font-bold uppercase opacity-60">Belum Ada Foto Biometrik</p>
                  <p className="text-[9px] text-slate-400 mt-1">Aktifkan kamera untuk merekam wajah pertama kali</p>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="mt-8 space-y-3">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full py-4 border-2 border-red-600 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all"
                >
                  📷 {capturedImage ? "AMBIL ULANG FOTO BARU" : oldPhoto ? "UPDATE SCAN WAJAH" : "REKAM WAJAH SEKARANG"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-100 animate-pulse"
                >
                  🎯 KUNCI WAJAH BARU
                </button>
              )}

              {capturedImage && !cameraActive && (
                <button
                  type="button"
                  onClick={() => {
                    setCapturedImage(null);
                    setFormData((prev) => ({ ...prev, foto_referensi: "" }));
                  }}
                  className="w-full py-2 text-red-500 font-bold text-[9px] uppercase hover:text-red-700 transition"
                >
                  Batalkan Foto Baru (Gunakan Foto Lama)
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

            <div className="mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-[9px] text-blue-600 font-bold uppercase mb-1">Tips USB:</p>
              <p className="text-[9px] text-blue-500 leading-relaxed">
                Jika kamera HP tidak terdeteksi, pastikan aplikasi <strong>DroidCam</strong> atau <strong>Iriun</strong>{" "}
                sudah terbuka di PC dan HP Anda sudah dalam mode <strong>USB Debugging</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
