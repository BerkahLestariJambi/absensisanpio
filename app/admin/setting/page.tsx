"use client";
import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

export default function AdminSetting() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminLoc, setAdminLoc] = useState<{ lat: number, lng: number } | null>(null);

  const [formData, setFormData] = useState({
    nama_sekolah: "",
    tahun_pelajaran: "",
    semester: "",
    jam_masuk: "07:00",
    jam_pulang_normal: "",
    jam_pulang_cepat_mulai: "",
    latitude_sekolah: "",
    longitude_sekolah: "",
    radius_maksimal: "50",
    logo_sekolah: null as File | null,
    current_logo: ""
  });

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("https://backendabsen.mejatika.com/api/setting-app");
        const result = await res.json();
        const d = result.success ? result.data : result;

        if (d) {
          setFormData({
            nama_sekolah: d.nama_sekolah || "",
            tahun_pelajaran: d.tahun_pelajaran || "",
            semester: d.semester || "1",
            jam_masuk: d.jam_masuk || "07:00",
            jam_pulang_normal: d.jam_pulang_normal || "12:45",
            jam_pulang_cepat_mulai: d.jam_pulang_cepat_mulai || "07:15",
            latitude_sekolah: d.latitude_sekolah || "",
            longitude_sekolah: d.longitude_sekolah || "",
            radius_maksimal: d.radius_maksimal || "50",
            logo_sekolah: null,
            current_logo: d.logo_sekolah || ""
          });
        }
      } catch (err) {
        console.error("Gagal load config:", err);
      } finally {
        setLoading(false);
      }
    };

    let watchId: number;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setAdminLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        null,
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }

    loadConfig();
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, []);

  const tangkapLokasiSekolah = () => {
    if (adminLoc) {
      setFormData(prev => ({
        ...prev,
        latitude_sekolah: adminLoc.lat.toFixed(8),
        longitude_sekolah: adminLoc.lng.toFixed(8)
      }));
      Swal.fire({
        title: "Lokasi Terdeteksi",
        text: "Koordinat GPS HP Anda telah dimasukkan.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false
      });
    } else {
      Swal.fire("GPS Belum Siap", "Pastikan izin lokasi aktif dan tunggu sinyal stabil.", "warning");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const token = localStorage.getItem("auth_token");
    const dataToSend = new FormData();
    
    // Validasi sederhana sebelum kirim
    if (!formData.latitude_sekolah || !formData.longitude_sekolah) {
        Swal.fire("LOKASI KOSONG", "Koordinat sekolah wajib diisi!", "error");
        setSaving(false);
        return;
    }

    Object.entries(formData).forEach(([key, value]) => {
        if (key === 'logo_sekolah') {
            if (value) dataToSend.append(key, value as File);
        } else if (key !== 'current_logo') {
            dataToSend.append(key, value as string);
        }
    });

    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/admin/setting-update", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        },
        body: dataToSend,
      });

      if (res.ok) {
        await Swal.fire({
          title: "BERHASIL",
          text: "Pengaturan telah diperbarui!",
          icon: "success",
          confirmButtonColor: "#dc2626"
        });
        router.push("/admin/dashboard");
      } else {
        const errorData = await res.json();
        Swal.fire("GAGAL", errorData.message || "Gagal menyimpan perubahan", "error");
      }
    } catch (err) {
      Swal.fire("Error", "Koneksi server terputus", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black animate-pulse text-slate-400 uppercase">Mengunduh Konfigurasi...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 border-t-8 border-red-600 font-sans">
      <div className="max-w-2xl mx-auto bg-white rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden">
        
        <div className="bg-red-600 p-8 text-center relative">
          <button onClick={() => router.back()} className="absolute left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white font-bold text-sm">
            ← KEMBALI
          </button>
          <h1 className="text-white text-xl font-black uppercase">Setting Instansi & Lokasi</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {/* LOGO */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase border-b pb-1">Logo Instansi</h3>
            <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-20 h-20 bg-white rounded-xl shadow-sm flex items-center justify-center overflow-hidden border">
                    {formData.logo_sekolah ? (
                        <img src={URL.createObjectURL(formData.logo_sekolah)} className="w-full h-full object-contain" alt="Preview" />
                    ) : formData.current_logo ? (
                        <img src={`https://backendabsen.mejatika.com/storage/${formData.current_logo}`} className="w-full h-full object-contain" alt="Current" />
                    ) : <span className="text-2xl">🏫</span>}
                </div>
                <div className="flex-1">
                    <input type="file" accept="image/*" onChange={(e) => setFormData({...formData, logo_sekolah: e.target.files?.[0] || null})} className="text-xs font-bold text-slate-500 cursor-pointer" />
                    <p className="text-[9px] text-slate-400 mt-2">PNG/JPG. Maksimal 2MB.</p>
                </div>
            </div>
          </div>

          {/* DATA SEKOLAH */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase border-b pb-1">Data Sekolah</h3>
            <input type="text" placeholder="Nama Sekolah" value={formData.nama_sekolah} onChange={(e) => setFormData({...formData, nama_sekolah: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-red-500 font-bold" required />
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="TP: 2025/2026" value={formData.tahun_pelajaran} onChange={(e) => setFormData({...formData, tahun_pelajaran: e.target.value})} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" />
              <select value={formData.semester} onChange={(e) => setFormData({...formData, semester: e.target.value})} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold">
                <option value="1">Semester Ganjil</option>
                <option value="2">Semester Genap</option>
              </select>
            </div>
          </div>

          {/* GEOFENCING */}
          <div className="p-6 bg-amber-50 rounded-[30px] border border-amber-200 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-black text-amber-600 uppercase">📍 Lokasi Geofencing</h3>
                <span className="text-[8px] bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-bold">BISA ISI MANUAL</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-bold text-slate-400 ml-2">LATITUDE</label>
                <input 
                    type="text" 
                    value={formData.latitude_sekolah} 
                    onChange={(e) => setFormData({...formData, latitude_sekolah: e.target.value})}
                    placeholder="-8.123456"
                    className="w-full p-3 bg-white border border-amber-200 rounded-xl text-xs font-mono focus:ring-2 ring-amber-400 outline-none" 
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 ml-2">LONGITUDE</label>
                <input 
                    type="text" 
                    value={formData.longitude_sekolah} 
                    onChange={(e) => setFormData({...formData, longitude_sekolah: e.target.value})}
                    placeholder="120.123456"
                    className="w-full p-3 bg-white border border-amber-200 rounded-xl text-xs font-mono focus:ring-2 ring-amber-400 outline-none" 
                />
              </div>
            </div>

            <button type="button" onClick={tangkapLokasiSekolah} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 text-xs uppercase">
              🎯 Gunakan Lokasi GPS Saya
            </button>
            
            <p className="text-[9px] text-amber-700 leading-tight italic">
                *Tips: Anda bisa menyalin koordinat langsung dari Google Maps lalu menempelkannya (paste) ke kotak di atas jika posisi GPS HP kurang akurat.
            </p>

            <div>
              <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Radius Absen (Meter)</label>
              <input type="number" value={formData.radius_maksimal} onChange={(e) => setFormData({...formData, radius_maksimal: e.target.value})} className="w-full p-3 bg-white border border-amber-200 rounded-xl text-sm font-bold" />
            </div>
          </div>

          {/* JAM KERJA */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase border-b pb-1">Aturan Waktu</h3>
            <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Jam Masuk</label>
                    <input type="time" value={formData.jam_masuk} onChange={(e) => setFormData({...formData, jam_masuk: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Pulang Normal</label>
                        <input type="time" value={formData.jam_pulang_normal} onChange={(e) => setFormData({...formData, jam_pulang_normal: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Pulang Cepat</label>
                        <input type="time" value={formData.jam_pulang_cepat_mulai} onChange={(e) => setFormData({...formData, jam_pulang_cepat_mulai: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                    </div>
                </div>
            </div>
          </div>

          <button type="submit" disabled={saving} className={`w-full py-5 rounded-[25px] font-black text-white text-lg shadow-xl transition-all ${saving ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-95'}`}>
            {saving ? "SEDANG MENYIMPAN..." : "SIMPAN PERUBAHAN"}
          </button>
        </form>
      </div>
    </div>
  );
}
