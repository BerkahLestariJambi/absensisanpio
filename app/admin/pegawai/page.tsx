"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function DaftarPegawai() {
  const [pegawai, setPegawai] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 1. Ambil Data dari API
  const fetchPegawai = async () => {
    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/pegawai");
      const data = await res.json();
      setPegawai(data);
    } catch (error) {
      console.error("Gagal mengambil data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPegawai();
  }, []);

  // 2. Fungsi Hapus
  const handleHapus = (id: string, nama: string) => {
    Swal.fire({
      title: `Hapus ${nama}?`,
      text: "Data yang dihapus tidak dapat dikembalikan!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Ya, Hapus!",
      cancelButtonText: "Batal"
    }). antiquity(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(`https://backendabsen.mejatika.com/api/pegawai/${id}`, {
            method: "DELETE",
          });
          if (res.ok) {
            Swal.fire("Terhapus!", "Data telah dihapus.", "success");
            fetchPegawai(); // Refresh data
          }
        } catch (error) {
          Swal.fire("Error", "Gagal menghapus data", "error");
        }
      }
    });
  };

  // 3. Filter Pencarian
  const filteredPegawai = pegawai.filter((p: any) =>
    p.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.nip.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-[#fdf5e6] bg-batik p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header & Aksi Utama */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Database Pegawai</h1>
            <p className="text-amber-800 font-bold text-xs tracking-widest italic">MANAJEMEN SUMBER DAYA MANUSIA SANPIO</p>
          </div>
          <button 
            onClick={() => router.push("/admin/pegawai/tambah")}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span>➕ TAMBAH PEGAWAI</span>
          </button>
        </div>

        {/* Statistik Singkat & Search */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-2 relative">
            <input 
              type="text" 
              placeholder="Cari berdasarkan nama atau NIP..."
              className="w-full p-4 pl-12 bg-white border border-amber-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-red-500 outline-none text-slate-700"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute left-4 top-4 text-slate-400">🔍</span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500 uppercase">Total Pegawai</span>
            <span className="text-2xl font-black text-red-600">{filteredPegawai.length}</span>
          </div>
        </div>

        {/* Tabel Data */}
        <div className="bg-white rounded-[30px] shadow-xl border border-amber-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-red-600 text-white">
                  <th className="p-5 text-xs font-bold uppercase tracking-widest">Pegawai</th>
                  <th className="p-5 text-xs font-bold uppercase tracking-widest">Jenjang / Jabatan</th>
                  <th className="p-5 text-xs font-bold uppercase tracking-widest">Kontak</th>
                  <th className="p-5 text-xs font-bold uppercase tracking-widest text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={4} className="p-10 text-center font-bold text-slate-400 animate-pulse">Memuat Data...</td></tr>
                ) : filteredPegawai.length === 0 ? (
                  <tr><td colSpan={4} className="p-10 text-center font-bold text-slate-400">Data Tidak Ditemukan</td></tr>
                ) : (
                  filteredPegawai.map((p: any) => (
                    <tr key={p.id} className="hover:bg-amber-50/50 transition-colors">
                      <td className="p-5">
                        <p className="font-black text-slate-800 uppercase leading-none mb-1">{p.nama}</p>
                        <p className="text-xs font-mono text-slate-500 tracking-tighter">NIP. {p.nip}</p>
                      </td>
                      <td className="p-5">
                        <span className="inline-block px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black rounded-full mb-1 mr-2">{p.jenjang}</span>
                        <p className="text-sm text-slate-600 font-medium">{p.jabatan}</p>
                      </td>
                      <td className="p-5 text-sm text-slate-600 italic">{p.email}</td>
                      <td className="p-5">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => router.push(`/admin/pegawai/edit/${p.id}`)}
                            className="p-2 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200 transition-colors"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => handleHapus(p.id, p.nama)}
                            className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors"
                            title="Hapus"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
