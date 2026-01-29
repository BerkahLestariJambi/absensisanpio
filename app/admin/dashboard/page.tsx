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
  
  // Data User dari LocalStorage
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const API_URL = "https://backendabsen.mejatika.com/api";

  // Fungsi Sinkronisasi Data dengan Header Auth
  const loadData = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return router.push("/admin/login");

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
      
      if (resGuru.status === 401) throw new Error("Unauthorized");

      setGurus(await resGuru.json());
      setIzins(await resIzin.json());
      setRekap(await resRekap.json());
    } catch (err) {
      console.error("Gagal sinkronisasi data.");
      router.push("/admin/login");
    }
  };

  useEffect(() => {
    // Ambil info user saat komponen dimuat
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

  // Fungsi Import Excel (Hanya untuk Super Admin)
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== "super_admin") return;

    if (!file) return Swal.fire("Pilih File", "Silakan pilih file Excel dulu.", "warning");

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/guru/import`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("auth_token")}` },
        body: formData,
      });

      if (res.ok) {
        Swal.fire("Berhasil", "Data Guru & Pegawai telah diupdate.", "success");
        setFile(null);
        loadData();
      } else {
        Swal.fire("Gagal", "Format file tidak sesuai atau akses ditolak.", "error");
      }
    } catch (err) {
      Swal.fire("Error", "Koneksi ke server terputus.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Fungsi Update Izin (Dibatasi di Backend)
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
        Swal.fire("Updated", `Status izin menjadi ${status}`, "success");
        loadData();
      } else {
        const errorData = await res.json();
        Swal.fire("Ditolak", errorData.message || "Bukan wewenang Anda.", "error");
      }
    } catch (err) {
      Swal.fire("Gagal", "Gagal memperbarui status.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Dashboard {userRole?.replace("_", " ")}</h1>
          <p className="text-slate-500 font-medium italic text-sm">Welcome back, {userName}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadData} className="bg-white border-2 border-slate-200 px-6 py-2 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition shadow-sm">
            🔄 REFRESH
          </button>
          <button onClick={handleLogout} className="bg-red-50 text-red-600 border-2 border-red-100 px-6 py-2 rounded-2xl font-bold hover:bg-red-600 hover:text-white transition shadow-sm">
            🚪 LOGOUT
          </button>
        </div>
      </header>

      {/* Navigasi Tab */}
      <div className="flex flex-wrap gap-4 md:gap-8 mb-8 border-b-2 border-slate-200">
        {[
          { id: "guru", label: "Data Guru & Pegawai" },
          { id: "rekap", label: "Rekap Kehadiran" },
          { id: "izin", label: "Persetujuan Izin" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-4 px-2 text-sm font-bold tracking-wider uppercase transition-all ${
              activeTab === tab.id ? "border-b-4 border-blue-600 text-blue-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: DATA GURU */}
      {activeTab === "guru" && (
        <div className="space-y-6 animate-in fade-in duration-500">
          
          {/* HANYA MUNCUL UNTUK SUPER ADMIN */}
          {userRole === "super_admin" && (
            <div className="bg-white p-8 rounded-[32px] shadow-xl shadow-slate-200 border border-white">
              <h3 className="font-black text-slate-800 text-lg mb-4 uppercase tracking-tight">Import Data Master (Admin Only)</h3>
              <form onSubmit={handleImport} className="flex flex-col md:flex-row gap-4">
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-2xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition cursor-pointer"
                />
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-300 transition-all active:scale-95"
                >
                  {loading ? "PROCESSING..." : "UPLOAD EXCEL"}
                </button>
              </form>
            </div>
          )}

          <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200 border border-white overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-800 text-white uppercase text-[10px] tracking-[0.2em]">
                <tr>
                  <th className="p-6">Nama Lengkap</th>
                  <th className="p-6">NIP/NUPTK</th>
                  <th className="p-6">Jenjang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gurus.map((g: any) => (
                  <tr key={g.id} className="hover:bg-blue-50/50 transition">
                    <td className="p-6 font-bold text-slate-700">{g.nama_lengkap}</td>
                    <td className="p-6 font-mono text-slate-500">{g.nip || g.nuptk || "—"}</td>
                    <td className="p-6">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${g.jenjang === 'SMA' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            {g.jenjang}
                        </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: REKAP KEHADIRAN */}
      {activeTab === "rekap" && (
        <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200 border border-white overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <table className="w-full text-left">
            <thead className="bg-slate-800 text-white uppercase text-[10px] tracking-[0.2em]">
              <tr>
                <th className="p-6">Timestamp</th>
                <th className="p-6">Nama Guru</th>
                <th className="p-4 text-center">Face ID</th>
                <th className="p-6">Geo-Location</th>
                <th className="p-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rekap.map((r: any) => (
                <tr key={r.id} className="hover:bg-blue-50/50 transition">
                  <td className="p-6 text-xs">
                    <div className="font-black text-slate-800">{new Date(r.created_at).toLocaleDateString()}</div>
                    <div className="text-blue-600 font-bold uppercase">{new Date(r.created_at).toLocaleTimeString()}</div>
                  </td>
                  <td className="p-6 font-bold text-slate-700">{r.nama_lengkap}</td>
                  <td className="p-4 text-center">
                    <img 
                      src={`https://backendabsen.mejatika.com/storage/${r.foto_wajah}`} 
                      className="w-12 h-12 object-cover rounded-xl border-2 border-white shadow-sm mx-auto"
                      alt="Face"
                    />
                  </td>
                  <td className="p-6">
                    <a 
                      href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} 
                      target="_blank" 
                      className="text-[10px] font-black bg-slate-100 text-slate-600 px-4 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                    >
                      📍 VIEW MAPS
                    </a>
                  </td>
                  <td className="p-6">
                    <span className={`text-[10px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest ${r.status === 'Hadir' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: PERSETUJUAN IZIN */}
      {activeTab === "izin" && (
        <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200 border border-white overflow-hidden animate-in fade-in duration-500">
          <table className="w-full text-left">
            <thead className="bg-slate-800 text-white uppercase text-[10px] tracking-[0.2em]">
              <tr>
                <th className="p-6">Pemohon</th>
                <th className="p-6">Keterangan</th>
                <th className="p-6">Dokumen</th>
                <th className="p-6 text-center">Konfirmasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {izins.map((i: any) => (
                <tr key={i.id} className="hover:bg-blue-50/50 transition">
                  <td className="p-6">
                    <div className="font-bold text-slate-800">{i.nama_lengkap}</div>
                    <div className="text-[10px] text-blue-500 font-bold uppercase">{i.jenis} ({i.jenjang})</div>
                  </td>
                  <td className="p-6 text-sm text-slate-500 italic">"{i.keterangan}"</td>
                  <td className="p-6">
                    {i.bukti_dokumen ? (
                      <a href={`https://backendabsen.mejatika.com/storage/${i.bukti_dokumen}`} target="_blank" className="text-blue-600 font-black text-xs underline">VIEW FILE</a>
                    ) : <span className="text-slate-300 text-xs font-bold">NO FILE</span>}
                  </td>
                  <td className="p-6">
                    <div className="flex justify-center gap-3">
                      {i.status === "Pending" ? (
                        <>
                          <button onClick={() => updateStatusIzin(i.id, "Disetujui")} className="bg-green-500 text-white px-5 py-2 rounded-xl text-[10px] font-black hover:bg-green-600 transition shadow-lg shadow-green-100">APPROVE</button>
                          <button onClick={() => updateStatusIzin(i.id, "Ditolak")} className="bg-red-500 text-white px-5 py-2 rounded-xl text-[10px] font-black hover:bg-red-600 transition shadow-lg shadow-red-100">REJECT</button>
                        </>
                      ) : (
                        <span className={`text-[10px] font-black uppercase tracking-widest ${i.status === 'Disetujui' ? 'text-green-600' : 'text-red-600'}`}>{i.status}</span>
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
