"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function TambahPegawai() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Sesuaikan dengan kolom di image_abfb56.png
  const [formData, setFormData] = useState({
    nama_lengkap: "",
    nip: "",
    nuptk: "",
    jabatan: "",
    jenjang: "SMP", // Default salah satu enum
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("https://backendabsen.mejatika.com/api/admin/guru", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await Swal.fire("Berhasil", "Data pegawai baru telah tersimpan", "success");
        router.push("/admin/dashboard");
      } else {
        const err = await res.json();
        throw new Error(err.message || "Gagal simpan");
      }
    } catch (error: any) {
      Swal.fire("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf5e6] bg-batik p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-md text-red-600 hover:bg-red-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Tambah Pegawai Baru</h1>
        </div>

        <div className="bg-white rounded-[30px] shadow-xl border border-amber-100 overflow-hidden">
          <div className="bg-slate-800 p-6 text-white text-center">
            <h2 className="text-lg font-bold tracking-widest uppercase">Form Data Master</h2>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Nama Lengkap */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama Lengkap (Sesuai Ijazah)</label>
                <input
                  required
                  type="text"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700"
                  onChange={(e) => setFormData({...formData, nama_lengkap: e.target.value})}
                />
              </div>

              {/* NIP */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">NIP (Jika Ada)</label>
                <input
                  type="text"
                  placeholder="—"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none font-mono"
                  onChange={(e) => setFormData({...formData, nip: e.target.value})}
                />
              </div>

              {/* NUPTK */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">NUPTK (Jika Ada)</label>
                <input
                  type="text"
                  placeholder="—"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none font-mono"
                  onChange={(e) => setFormData({...formData, nuptk: e.target.value})}
                />
              </div>

              {/* Jenjang - Sesuai ENUM Database */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Jenjang Unit</label>
                <select 
                  required
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700 appearance-none"
                  onChange={(e) => setFormData({...formData, jenjang: e.target.value})}
                  value={formData.jenjang}
                >
                  <option value="SMP">SMP</option>
                  <option value="SMA">SMA</option>
                </select>
              </div>

              {/* Jabatan */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Jabatan</label>
                <input
                  type="text"
                  placeholder="Contoh: Guru Matematika"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700"
                  onChange={(e) => setFormData({...formData, jabatan: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-5">
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 rounded-2xl font-black tracking-widest text-white shadow-xl transition-all active:scale-95 ${
                  loading ? "bg-slate-400" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {loading ? "MENYIMPAN..." : "💾 SIMPAN DATA PEGAWAI"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
