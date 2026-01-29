"use client";
import { useState, useEffect } from "react";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("guru");
  const [gurus, setGurus] = useState([]);
  const [izins, setIzins] = useState([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const API_URL = "https://backendabsen.mejatika.com/api";

  // 1. Fungsi Ambil Data (Load Data)
  const loadData = async () => {
    try {
      const [resGuru, resIzin] = await Promise.all([
        fetch(`${API_URL}/admin/guru`),
        fetch(`${API_URL}/admin/daftar-izin`)
      ]);
      
      const dataGuru = await resGuru.json();
      const dataIzin = await resIzin.json();
      
      setGurus(dataGuru);
      setIzins(dataIzin);
    } catch (err) {
      console.error("Gagal mengambil data:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 2. Fungsi Import Excel
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Pilih file Excel dulu!");

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/guru/import`, {
        method: "POST",
        body: formData, // Fetch otomatis mengatur header multipart/form-data
      });

      if (res.ok) {
        alert("Data Guru Berhasil Diimport!");
        setFile(null);
        loadData();
      } else {
        alert("Gagal mengimport data.");
      }
    } catch (err) {
      alert("Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Fungsi Update Status Izin (Setujui/Tolak)
  const handleUpdateStatus = async (id: number, status: "Disetujui" | "Ditolak") => {
    try {
      const res = await fetch(`${API_URL}/admin/izin/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        alert(`Pengajuan berhasil di-${status.toLowerCase()}`);
        loadData(); // Refresh tabel
      }
    } catch (err) {
      alert("Gagal memperbarui status.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-800">Panel Admin Sanpio</h1>
        <p className="text-slate-500 text-sm">Sistem Monitoring Absensi & Kepegawaian</p>
      </header>

      {/* Navigasi Tab */}
      <div className="flex gap-6 mb-6">
        <button 
          onClick={() => setActiveTab("guru")} 
          className={`pb-2 transition ${activeTab === "guru" ? "border-b-2 border-blue-600 text-blue-600 font-bold" : "text-slate-400"}`}
        >
          Data Guru
        </button>
        <button 
          onClick={() => setActiveTab("izin")} 
          className={`pb-2 transition ${activeTab === "izin" ? "border-b-2 border-blue-600 text-blue-600 font-bold" : "text-slate-400"}`}
        >
          Persetujuan Izin
        </button>
      </div>

      {/* TAB 1: DATA GURU */}
      {activeTab === "guru" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="font-semibold mb-4">Import Data Guru (.xlsx)</h3>
            <form onSubmit={handleImport} className="flex flex-col md:flex-row gap-4">
              <input 
                type="file" 
                accept=".xlsx, .xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <button 
                type="submit" 
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition"
              >
                {loading ? "Memproses..." : "Upload Guru"}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 font-semibold text-slate-700">Nama Lengkap</th>
                  <th className="p-4 font-semibold text-slate-700">NIP/NUPTK</th>
                  <th className="p-4 font-semibold text-slate-700">Jenjang</th>
                </tr>
              </thead>
              <tbody>
                {gurus.map((g: any) => (
                  <tr key={g.id} className="border-b hover:bg-slate-50">
                    <td className="p-4 text-slate-600">{g.nama_lengkap}</td>
                    <td className="p-4 text-slate-600">{g.nip || g.nuptk || "-"}</td>
                    <td className="p-4 text-slate-600">{g.jenjang}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PERSETUJUAN IZIN */}
      {activeTab === "izin" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-4">Guru</th>
                <th className="p-4">Jenis</th>
                <th className="p-4">Keterangan</th>
                <th className="p-4">Bukti</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {izins.map((i: any) => (
                <tr key={i.id} className="border-b">
                  <td className="p-4 font-medium">{i.nama_lengkap}</td>
                  <td className="p-4">
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">{i.jenis}</span>
                  </td>
                  <td className="p-4 text-slate-500 text-sm">{i.keterangan}</td>
                  <td className="p-4">
                    {i.bukti_dokumen ? (
                      <a 
                        href={`https://backendabsen.mejatika.com/storage/${i.bukti_dokumen}`} 
                        target="_blank" 
                        className="text-blue-600 hover:underline text-xs font-semibold"
                      >
                        Lihat Dokumen
                      </a>
                    ) : "-"}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      {i.status === "Pending" ? (
                        <>
                          <button 
                            onClick={() => handleUpdateStatus(i.id, "Disetujui")}
                            className="bg-green-100 text-green-700 px-3 py-1 rounded-md text-xs font-bold hover:bg-green-200"
                          >
                            Setujui
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus(i.id, "Ditolak")}
                            className="bg-red-100 text-red-700 px-3 py-1 rounded-md text-xs font-bold hover:bg-red-200"
                          >
                            Tolak
                          </button>
                        </>
                      ) : (
                        <span className={`text-xs font-bold ${i.status === 'Disetujui' ? 'text-green-600' : 'text-red-600'}`}>
                          {i.status}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
