"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function TambahPegawai() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nama: "",
    nip: "",
    jenjang: "", // Field baru untuk Jenjang
    jabatan: "",
    email: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/pegawai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        Swal.fire("Berhasil", "Data pegawai telah disimpan", "success");
        router.push("/admin/dashboard");
      } else {
        throw new Error("Gagal menyimpan data");
      }
    } catch (error) {
      Swal.fire("Error", "Gagal menghubungi server", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf5e6] bg-batik p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        {/* Header Dashboard */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-md hover:bg-red-50 transition-colors text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Input Data Pegawai</h1>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-[30px] shadow-xl border border-amber-100 overflow-hidden">
          <div className="bg-red-600 p-6 text-white text-center">
            <p className="text-[10px] tracking-[0.4em] font-bold opacity-80 uppercase mb-1">Sanpio System Administrator</p>
            <h2 className="text-xl font-black tracking-tight">FORMULIR PEGAWAI BARU</h2>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Nama Lengkap */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nama Lengkap</label>
                <input
                  required
                  type="text"
                  placeholder="Masukkan nama"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-slate-800 font-medium"
                  onChange={(e) => setFormData({...formData, nama: e.target.value})}
                />
              </div>

              {/* NIP / ID */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">NIP / ID Pegawai</label>
                <input
                  required
                  type="text"
                  placeholder="ID Pegawai"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-slate-800 font-mono"
                  onChange={(e) => setFormData({...formData, nip: e.target.value})}
                />
              </div>

              {/* Jenjang (Update Baru) */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Jenjang Unit</label>
                <select 
                  required
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-slate-800 font-medium appearance-none"
                  onChange={(e) => setFormData({...formData, jenjang: e.target.value})}
                >
                  <option value="">Pilih Jenjang</option>
                  <option value="TK">TK (Taman Kanak-kanak)</option>
                  <option value="SD">SD (Sekolah Dasar)</option>
                  <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
                  <option value="SMA">SMA (Sekolah Menengah Atas)</option>
                  <option value="SMK">SMK (Sekolah Menengah Kejuruan)</option>
                </select>
              </div>

              {/* Jabatan */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Jabatan</label>
                <select 
                  required
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-slate-800 font-medium appearance-none"
                  onChange={(e) => setFormData({...formData, jabatan: e.target.value})}
                >
                  <option value="">Pilih Jabatan</option>
                  <option value="Kepala Sekolah">Kepala Sekolah</option>
                  <option value="Guru Tetap">Guru Tetap</option>
                  <option value="Guru Honorer">Guru Honorer</option>
                  <option value="Staff Tata Usaha">Staff Tata Usaha</option>
                  <option value="Keamanan">Keamanan / Satpam</option>
                  <option value="Kebersihan">Cleaning Service</option>
                </select>
              </div>

              {/* Email */}
              <div className="col-span-1 md:col-span-2 space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Alamat Email</label>
                <input
                  required
                  type="email"
                  placeholder="email@sekolah.sch.id"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-slate-800 font-medium"
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 rounded-2xl font-black tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
                  loading ? "bg-slate-400" : "bg-red-600 hover:bg-red-700 shadow-red-200"
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    MEMPROSES...
                  </>
                ) : (
                  "💾 SIMPAN DATA PEGAWAI"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx global>{`
        .bg-batik {
          background-image: url("https://www.transparenttextures.com/patterns/batik.png");
        }
      `}</style>
    </div>
  );
}
