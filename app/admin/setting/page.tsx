"use client";
import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

export default function AdminSetting() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // State untuk form data sesuai API backendabsen.mejatika.com
  const [formData, setFormData] = useState({
    nama_sekolah: "",
    tahun_pelajaran: "",
    semester: "",
    jam_pulang_normal: "",
    jam_pulang_cepat_mulai: "",
    logo_sekolah: null as File | null,
    current_logo: ""
  });

  // 1. Load Data Konfigurasi Saat Ini
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("https://backendabsen.mejatika.com/api/setting-app");
        const result = await res.json();
        if (result.success) {
          const d = result.data;
          setFormData({
            nama_sekolah: d.nama_sekolah || "",
            tahun_pelajaran: d.tahun_pelajaran || "",
            semester: d.semester || "1",
            jam_pulang_normal: d.jam_pulang_normal || "12:45",
            jam_pulang_cepat_mulai: d.jam_pulang_cepat_mulai || "07:15",
            logo_sekolah: null,
            current_logo: d.logo_sekolah || ""
          });
        }
      } catch (err) {
        Swal.fire("Error", "Gagal memuat data dari server", "error");
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  // 2. Fungsi Simpan (Update)
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const dataToSend = new FormData();
    dataToSend.append("nama_sekolah", formData.nama_sekolah);
    dataToSend.append("tahun_pelajaran", formData.tahun_pelajaran);
    dataToSend.append("semester", formData.semester);
    dataToSend.append("jam_pulang_normal", formData.jam_pulang_normal);
    dataToSend.append("jam_pulang_cepat_mulai", formData.jam_pulang_cepat_mulai);
    
    // Hanya kirim logo jika user memilih file baru
    if (formData.logo_sekolah) {
      dataToSend.append("logo_sekolah", formData.logo_sekolah);
    }

    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/admin/setting-update", {
        method: "POST", // Menggunakan POST karena membawa File (Multipart)
        body: dataToSend,
      });

      const result = await res.json();
      if (res.ok && result.success) {
        await Swal.fire({
          title: "BERHASIL",
          text: "Pengaturan aplikasi telah diperbarui!",
          icon: "success",
          timer: 2000
        });
        router.refresh();
      } else {
        Swal.fire("GAGAL", result.message || "Terjadi kesalahan", "error");
      }
    } catch (err) {
      Swal.fire("Error", "Koneksi ke server terputus", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold text-slate-400 animate-pulse">
        MEMUAT KONFIGURASI...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf5e6] p-4 md:p-10 font-sans border-t-8 border-red-600">
      <div className="max-w-2xl mx-auto bg-white/95 rounded-[40px] shadow-2xl border border-amber-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-red-600 p-8 text-center">
           <h1 className="text-white text-2xl font-black uppercase tracking-widest">⚙️ SETTING APP</h1>
           <p className="text-red-100 text-[10px] font-bold mt-1 tracking-widest uppercase">Admin Panel Control</p>
        </div>

        <form onSubmit={handleUpdate} className="p-8 space-y-6">
          
          {/* Section: Instansi */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-red-600 border-b-2 border-red-100 pb-1 inline-block uppercase">Informasi Sekolah</h3>
            
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase">Nama Instansi / Sekolah</label>
              <input 
                type="text" 
                value={formData.nama_sekolah}
                onChange={(e) => setFormData({...formData, nama_sekolah: e.target.value})}
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-red-500 outline-none font-bold text-slate-700 transition-all"
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase">Tahun Pelajaran</label>
                <input 
                  type="text" 
                  value={formData.tahun_pelajaran}
                  onChange={(e) => setFormData({...formData, tahun_pelajaran: e.target.value})}
                  placeholder="2025/2026"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-red-500 outline-none font-bold text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase">Semester</label>
                <select 
                  value={formData.semester}
                  onChange={(e) => setFormData({...formData, semester: e.target.value})}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-red-500 outline-none font-bold text-slate-700"
                >
                  <option value="1">1 (GANJIL)</option>
                  <option value="2">2 (GENAP)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase">Ganti Logo Sekolah</label>
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200">
                {formData.current_logo && (
                  <img 
                    src={`https://backendabsen.mejatika.com/storage/${formData.current_logo}`} 
                    className="w-14 h-14 object-contain rounded-lg" 
                    alt="Current Logo" 
                  />
                )}
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setFormData({...formData, logo_sekolah: e.target.files?.[0] || null})}
                  className="text-[10px] text-slate-400 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Section: Waktu */}
          <div className="space-y-4 pt-4">
            <h3 className="text-xs font-black text-red-600 border-b-2 border-red-100 pb-1 inline-block uppercase">Aturan Waktu (WITA)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                <label className="block text-[10px] font-black text-amber-600 mb-2 uppercase">Jam Pulang Normal</label>
                <input 
                  type="time" 
                  value={formData.jam_pulang_normal}
                  onChange={(e) => setFormData({...formData, jam_pulang_normal: e.target.value})}
                  className="w-full bg-transparent text-xl font-black text-slate-700 outline-none"
                />
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                <label className="block text-[10px] font-black text-amber-600 mb-2 uppercase">Batas Pulang Cepat</label>
                <input 
                  type="time" 
                  value={formData.jam_pulang_cepat_mulai}
                  onChange={(e) => setFormData({...formData, jam_pulang_cepat_mulai: e.target.value})}
                  className="w-full bg-transparent text-xl font-black text-slate-700 outline-none"
                />
              </div>
            </div>
            <p className="text-[9px] text-slate-400 font-bold italic">* Pulang cepat dihitung jika absen di antara Jam Batas Pulang Cepat hingga Jam Pulang Normal.</p>
          </div>

          <div className="pt-8">
            <button 
              type="submit" 
              disabled={saving}
              className={`w-full py-5 rounded-[20px] font-black text-white text-lg shadow-xl transition-all ${saving ? 'bg-slate-400 scale-95' : 'bg-red-600 hover:bg-red-700 active:scale-95 shadow-red-200'}`}
            >
              {saving ? "⏳ SEDANG MENYIMPAN..." : "💾 SIMPAN PERUBAHAN"}
            </button>
            
            <button 
              type="button"
              onClick={() => router.push("/")}
              className="w-full mt-4 py-2 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-red-500 transition-colors"
            >
              ← Kembali ke Mesin Absensi
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
