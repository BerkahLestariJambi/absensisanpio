"use client";
import { useState, useEffect } from "react";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("guru");
  const [gurus, setGurus] = useState([]);
  const [izins, setIzins] = useState([]);
  const [rekap, setRekap] = useState([]); // State baru untuk rekap
  const [loading, setLoading] = useState(false);

  const API_URL = "https://backendabsen.mejatika.com/api";

  const loadData = async () => {
    try {
      const [resGuru, resIzin, resRekap] = await Promise.all([
        fetch(`${API_URL}/admin/guru`),
        fetch(`${API_URL}/admin/daftar-izin`),
        fetch(`${API_URL}/admin/rekap-absensi`) // Endpoint rekap
      ]);
      
      setGurus(await resGuru.json());
      setIzins(await resIzin.json());
      setRekap(await resRekap.json());
    } catch (err) {
      console.error("Gagal load data");
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Panel Admin Sanpio</h1>
        <p className="text-slate-500 text-sm">Monitoring Real-time</p>
      </header>

      {/* Navigasi Tab */}
      <div className="flex gap-6 mb-6 border-b">
        <button onClick={() => setActiveTab("guru")} className={`pb-2 ${activeTab === "guru" ? "border-b-2 border-blue-600 font-bold text-blue-600" : "text-slate-400"}`}>Data Guru</button>
        <button onClick={() => setActiveTab("rekap")} className={`pb-2 ${activeTab === "rekap" ? "border-b-2 border-blue-600 font-bold text-blue-600" : "text-slate-400"}`}>Rekap Absensi</button>
        <button onClick={() => setActiveTab("izin")} className={`pb-2 ${activeTab === "izin" ? "border-b-2 border-blue-600 font-bold text-blue-600" : "text-slate-400"}`}>Persetujuan Izin</button>
      </div>

      {/* TAB 1: DATA GURU (Sama seperti sebelumnya) */}
      {activeTab === "guru" && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
           {/* ... kode tabel guru ... */}
           <p className="text-sm text-slate-500 italic">Gunakan fitur import Excel untuk memperbarui data guru.</p>
        </div>
      )}

      {/* TAB 2: REKAP KEHADIRAN (FITUR BARU) */}
      {activeTab === "rekap" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-slate-700">
              <tr>
                <th className="p-4">Tanggal/Jam</th>
                <th className="p-4">Nama Guru</th>
                <th className="p-4">Foto Wajah</th>
                <th className="p-4">Lokasi (GPS)</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {rekap.length > 0 ? rekap.map((r: any) => (
                <tr key={r.id} className="border-b hover:bg-slate-50">
                  <td className="p-4 text-xs">
                    <span className="font-bold">{r.created_at.split('T')[0]}</span><br/>
                    <span className="text-blue-600">{r.created_at.split('T')[1].substring(0,5)} WIB</span>
                  </td>
                  <td className="p-4 font-medium text-slate-800">{r.nama_lengkap}</td>
                  <td className="p-4">
                    <img 
                      src={`https://backendabsen.mejatika.com/storage/${r.foto_wajah}`} 
                      className="w-12 h-12 object-cover rounded-lg border shadow-sm"
                      alt="Wajah"
                    />
                  </td>
                  <td className="p-4">
                    <a 
                      href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} 
                      target="_blank" 
                      className="text-[10px] bg-slate-100 px-2 py-1 rounded text-blue-600 underline"
                    >
                      Buka Maps
                    </a>
                  </td>
                  <td className="p-4">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">
                      Hadir
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="p-10 text-center text-slate-400">Belum ada data kehadiran hari ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: IZIN (Sama seperti sebelumnya) */}
      {activeTab === "izin" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
           {/* ... kode tabel izin ... */}
        </div>
      )}
    </div>
  );
}
