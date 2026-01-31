"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("guru");
  const [gurus, setGurus] = useState([]);
  const [izins, setIzins] = useState([]);
  const [rekap, setRekap] = useState([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const API_URL = "https://backendabsen.mejatika.com/api";

  const loadData = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return router.push("/admin/login");

    setLoading(true);
    try {
      const headers = { 
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      };

      const [resGuru, resIzin, resRekap] = await Promise.all([
        fetch(`${API_URL}/admin/guru`, { headers }),
        fetch(`${API_URL}/admin/daftar-izin`, { headers }),
        fetch(`${API_URL}/admin/rekap-absensi`, { headers })
      ]);
      
      const dataGuru = await resGuru.json();
      const dataIzin = await resIzin.json();
      const dataRekap = await resRekap.json();

      setGurus(Array.isArray(dataGuru) ? dataGuru : dataGuru.data || []);
      setIzins(Array.isArray(dataIzin) ? dataIzin : dataIzin.data || []);
      setRekap(Array.isArray(dataRekap) ? dataRekap : dataRekap.data || []);
    } catch (err) {
      console.error("Gagal sinkronisasi data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    const name = localStorage.getItem("user_name");
    if (!role) {
      router.push("/admin/login");
    } else {
      setUserRole(role);
      setUserName(name);
      loadData();
    }
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/admin/login");
  };

  const updateStatusIzin = async (id: number, status: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/izin/${id}/status`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        Swal.fire("Berhasil", `Izin telah ${status}`, "success");
        loadData();
      }
    } catch (err) {
      Swal.fire("Gagal", "Error sistem.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans bg-batik">
      {/* HEADER SECTION */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[30px] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">
            <span className="text-red-600">SANPIO</span> {userRole?.replace("_", " ")}
          </h1>
          <p className="text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase">Petugas: {userName}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.open('/', '_blank')} className="bg-amber-50 text-amber-600 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-amber-100 transition uppercase border border-amber-100">🖥️ Buka Mesin</button>
          <button onClick={loadData} className={`bg-slate-100 p-3 rounded-xl hover:bg-slate-200 transition ${loading ? 'animate-spin' : ''}`}>🔄</button>
          <button onClick={handleLogout} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl font-black text-xs hover:bg-red-600 hover:text-white transition border border-red-100 uppercase tracking-widest">🚪 Keluar</button>
        </div>
      </header>

      {/* NAV TAB */}
      <nav className="flex flex-wrap gap-2 mb-8 bg-white/80 backdrop-blur-md p-2 rounded-2xl shadow-sm w-fit border border-white">
        {[
          { id: "guru", label: "Pegawai", icon: "👥" },
          { id: "rekap", label: "Kehadiran", icon: "📅" },
          { id: "izin", label: "Izin & Sakit", icon: "✉️" },
          { id: "setting", label: "Setting", icon: "⚙️" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-2.5 px-6 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-2 ${
              activeTab === tab.id ? "bg-red-600 text-white shadow-xl shadow-red-200" : "text-slate-400 hover:bg-slate-50"
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </nav>

      {/* CONTENT AREA */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* TAB PEGAWAI (CRUD) */}
        {activeTab === "guru" && (
          <div className="space-y-4">
             <div className="flex justify-between items-end">
                <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest ml-2">Manajemen Data Pegawai</h2>
                <button onClick={() => router.push("/admin/pegawai/tambah")} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black hover:scale-105 transition shadow-lg">+ TAMBAH GURU</button>
             </div>
             {/* ... (Gunakan kode tabel guru Anda yang sebelumnya di sini) ... */}
          </div>
        )}

        {/* TAB REKAP KEHADIRAN */}
        {activeTab === "rekap" && (
          <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Log Absensi Real-time</h3>
                <span className="bg-red-100 text-red-600 text-[9px] font-black px-3 py-1 rounded-full uppercase italic">Waktu Server: WITA</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white text-slate-400 uppercase text-[9px] font-black tracking-widest border-b">
                  <tr>
                    <th className="p-6 text-center w-20">Foto</th>
                    <th className="p-6">Informasi Guru</th>
                    <th className="p-6 text-center">Waktu Absen</th>
                    <th className="p-6 text-center">Status</th>
                    <th className="p-6 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rekap.length > 0 ? rekap.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <img 
                          src={`https://backendabsen.mejatika.com/storage/${r.foto_wajah}`} 
                          className="w-12 h-12 object-cover rounded-2xl border-2 border-white shadow-md mx-auto hover:scale-150 transition" 
                          alt="Face" 
                        />
                      </td>
                      <td className="p-6">
                        <div className="font-black text-slate-800 uppercase text-xs">{r.nama_lengkap}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase italic">{r.jenjang}</div>
                      </td>
                      <td className="p-6 text-center">
                        <div className="font-bold text-slate-700 text-xs">{new Date(r.created_at).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})}</div>
                        <div className="text-red-600 font-black text-xs tracking-tighter">{new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      </td>
                      <td className="p-6 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${r.status_absen === 'Cepat' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                           {r.status_absen || 'Normal'}
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <a 
                          href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} 
                          target="_blank" 
                          className="inline-block p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition shadow-sm"
                        >
                          📍
                        </a>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="p-10 text-center font-bold text-slate-300">Belum ada data absensi hari ini</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB IZIN & SAKIT */}
        {activeTab === "izin" && (
          <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Persetujuan Izin & Sakit</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white text-slate-400 uppercase text-[9px] font-black tracking-widest border-b">
                  <tr>
                    <th className="p-6">Nama Pegawai</th>
                    <th className="p-6">Jenis & Alasan</th>
                    <th className="p-6 text-center">Lampiran</th>
                    <th className="p-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {izins.map((i: any) => (
                    <tr key={i.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-6">
                        <div className="font-black text-slate-800 uppercase text-xs">{i.nama_lengkap}</div>
                        <div className="text-[9px] text-slate-400 font-mono italic">{new Date(i.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="p-6">
                        <span className="text-[9px] font-black px-2 py-0.5 bg-blue-100 text-blue-600 rounded uppercase mb-1 inline-block">{i.jenis}</span>
                        <div className="text-xs text-slate-500 font-medium italic">"{i.keterangan}"</div>
                      </td>
                      <td className="p-6 text-center">
                        {i.foto_bukti ? (
                           <button onClick={() => window.open(`https://backendabsen.mejatika.com/storage/${i.foto_bukti}`)} className="text-[10px] font-black text-red-600 hover:underline">LIHAT BUKTI</button>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="p-6">
                        <div className="flex justify-center gap-2">
                          {i.status === "Pending" ? (
                            <>
                              <button onClick={() => updateStatusIzin(i.id, "Disetujui")} className="bg-green-500 text-white px-4 py-2 rounded-xl text-[9px] font-black hover:shadow-lg hover:shadow-green-100 transition uppercase">Setuju</button>
                              <button onClick={() => updateStatusIzin(i.id, "Ditolak")} className="bg-red-500 text-white px-4 py-2 rounded-xl text-[9px] font-black hover:shadow-lg hover:shadow-red-100 transition uppercase">Tolak</button>
                            </>
                          ) : (
                            <span className={`text-[10px] font-black px-4 py-2 rounded-full border uppercase ${i.status === 'Disetujui' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
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
          </div>
        )}

        {/* TAB SETTING (INTEGRASI) */}
        {activeTab === "setting" && (
           <div className="bg-white p-12 rounded-[40px] shadow-xl border border-slate-100 text-center space-y-6 animate-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-red-50 text-red-600 rounded-[30px] flex items-center justify-center text-4xl mx-auto shadow-inner rotate-3">⚙️</div>
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Konfigurasi Aplikasi</h2>
                <p className="text-slate-400 text-xs font-medium max-w-sm mx-auto mt-2 italic">Kelola lokasi sekolah (Geofencing), nama instansi, tahun ajaran, dan jam operasional absensi.</p>
              </div>
              <button 
                onClick={() => router.push('/admin/setting')}
                className="bg-red-600 text-white px-10 py-4 rounded-[20px] font-black text-xs tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-100 active:scale-95"
              >
                BUKA PANEL PENGATURAN
              </button>
           </div>
        )}

      </div>

      <style jsx global>{`
        .bg-batik {
          background-image: url("https://www.transparenttextures.com/patterns/batik.png");
          background-attachment: fixed;
        }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}
