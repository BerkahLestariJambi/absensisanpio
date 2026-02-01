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
    jam_masuk: "07:00", // Tambahan Field Jam Masuk
    jam_pulang_normal: "",
    jam_pulang_cepat_mulai: "",
    lat_sekolah: "",
    lng_sekolah: "",
    radius_meter: "50",
    logo_sekolah: null as File | null,
    current_logo: ""
  });

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("https://backendabsen.mejatika.com/api/setting-app");
        const result = await res.json();
        
        // Sesuaikan dengan struktur data backend (biasanya result.data atau result langsung)
        const d = result.success ? result.data : result;

        if (d) {
          setFormData({
            nama_sekolah: d.nama_sekolah || "",
            tahun_pelajaran: d.tahun_pelajaran || "",
            semester: d.semester || "1",
            jam_masuk: d.jam_masuk || "07:00",
            jam_pulang_normal: d.jam_pulang_normal || "12:45",
            jam_pulang_cepat_mulai: d.jam_pulang_cepat_mulai || "07:15",
            lat_sekolah: d.lat_sekolah || "",
            lng_sekolah: d.lng_sekolah || "",
            radius_meter: d.radius_meter || "50",
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

    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition((pos) => {
        setAdminLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, null, { enableHighAccuracy: true });
    }

    loadConfig();
  }, []);

  const tangkapLokasiSekolah = () => {
    if (adminLoc) {
      setFormData(prev => ({
        ...prev,
        lat_sekolah: adminLoc.lat.toString(),
        lng_sekolah: adminLoc.lng.toString()
      }));
      Swal.fire({
        title: "Lokasi Terkunci!",
        text: `Koordinat ${adminLoc.lat}, ${adminLoc.lng} berhasil diambil.`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false
      });
    } else {
      Swal.fire("GPS Belum Siap", "Mohon tunggu sebentar hingga sinyal GPS stabil.", "warning");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const token = localStorage.getItem("auth_token");
    const dataToSend = new FormData();
    
    // Append data teks
    dataToSend.append("nama_sekolah", formData.nama_sekolah);
    dataToSend.append("tahun_pelajaran", formData.tahun_pelajaran);
    dataToSend.append("semester", formData.semester);
    dataToSend.append("jam_masuk", formData.jam_masuk);
    dataToSend.append("jam_pulang_normal", formData.jam_pulang_normal);
    dataToSend.append("jam_pulang_cepat_mulai", formData.jam_pulang_cepat_mulai);
    dataToSend.append("lat_sekolah", formData.lat_sekolah);
    dataToSend.append("lng_sekolah", formData.lng_sekolah);
    dataToSend.append("radius_meter", formData.radius_meter);

    // Append logo jika ada file baru yang dipilih
    if (formData.logo_sekolah) {
      dataToSend.append("logo_sekolah", formData.logo_sekolah);
    }

    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/admin/setting-update", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`, // Tambahkan token jika endpoint ini terproteksi
          "Accept": "application/json"
        },
        body: dataToSend,
      });

      if (res.ok) {
        await Swal.fire({
          title: "BERHASIL",
          text: "Pengaturan telah diperbarui!",
          icon: "success",
          confirmButtonText: "OK",
          confirmButtonColor: "#dc2626"
        });
        // Kembali ke Dashboard
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
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 border-t-8 border-red-600">
      <div className="max-w-2xl mx-auto bg-white rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden">
        
        <div className="bg-red-600 p-8 text-center relative">
          <button 
            onClick={() => router.back()} 
            className="absolute left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white font-bold text-sm"
          >
            ← KEMBALI
          </button>
          <h1 className="text-white text-xl font-black uppercase">Setting Instansi & Lokasi</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {/* SEKSI 0: UPLOAD LOGO */}
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
                    <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => setFormData({...formData, logo_sekolah: e.target.files?.[0] || null})}
                        className="text-xs font-bold text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-red-50 file:text-red-600 hover:file:bg-red-100 cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-400 mt-2">PNG/JPG. Maksimal 2MB.</p>
                </div>
            </div>
          </div>

          {/* SEKSI 1: PROFIL */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase border-b pb-1">Data Sekolah</h3>
            <input 
              type="text" placeholder="Nama Sekolah" value={formData.nama_sekolah}
              onChange={(e) => setFormData({...formData, nama_sekolah: e.target.value})}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-red-500 font-bold"
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="TP: 2025/2026" value={formData.tahun_pelajaran} onChange={(e) => setFormData({...formData, tahun_pelajaran: e.target.value})} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" />
              <select value={formData.semester} onChange={(e) => setFormData({...formData, semester: e.target.value})} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold">
                <option value="1">Semester Ganjil</option>
                <option value="2">Semester Genap</option>
              </select>
            </div>
          </div>

          {/* SEKSI 2: LOKASI GEOFENCING */}
          <div className="p-6 bg-amber-50 rounded-[30px] border border-amber-200 space-y-4">
            <h3 className="text-[10px] font-black text-amber-600 uppercase">📍 Lokasi Sekolah (Geofencing)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-bold text-slate-400 ml-2">LATITUDE</label>
                <input type="text" value={formData.lat_sekolah} readOnly className="w-full p-3 bg-white border border-amber-200 rounded-xl text-xs font-mono" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 ml-2">LONGITUDE</label>
                <input type="text" value={formData.lng_sekolah} readOnly className="w-full p-3 bg-white border border-amber-200 rounded-xl text-xs font-mono" />
              </div>
            </div>

            <button 
              type="button" 
              onClick={tangkapLokasiSekolah}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 text-xs uppercase"
            >
              🎯 Ambil Lokasi Saya Sekarang
            </button>
            
            <div>
              <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Radius Absen (Meter)</label>
              <input 
                type="number" value={formData.radius_meter}
                onChange={(e) => setFormData({...formData, radius_meter: e.target.value})}
                className="w-full p-3 bg-white border border-amber-200 rounded-xl text-sm font-bold"
              />
            </div>
          </div>

          {/* SEKSI 3: JAM KERJA */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase border-b pb-1">Aturan Waktu</h3>
            <div>
                <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">Jam Masuk (Batas Terlambat)</label>
                <input type="time" value={formData.jam_masuk} onChange={(e) => setFormData({...formData, jam_masuk: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold mb-4" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-bold text-slate-400 ml-2">PULANG NORMAL</label>
                <input type="time" value={formData.jam_pulang_normal} onChange={(e) => setFormData({...formData, jam_pulang_normal: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 ml-2">PULANG CEPAT MULAI</label>
                <input type="time" value={formData.jam_pulang_cepat_mulai} onChange={(e) => setFormData({...formData, jam_pulang_cepat_mulai: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={saving}
            className={`w-full py-5 rounded-[25px] font-black text-white text-lg shadow-xl transition-all ${saving ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-95'}`}
          >
            {saving ? "SEDANG MENYIMPAN..." : "SIMPAN PERUBAHAN"}
          </button>
        </form>
      </div>
    </div>
  );
}
