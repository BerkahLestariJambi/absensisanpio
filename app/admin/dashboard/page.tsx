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

  // --- FITUR HAPUS GURU ---
  const handleHapusGuru = async (id: number, nama: string) => {
    Swal.fire({
      title: `Hapus ${nama}?`,
      text: "Data guru dan riwayat absen akan terhapus permanen!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Ya, Hapus!",
      cancelButtonText: "Batal"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(`${API_URL}/admin/guru/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${localStorage.getItem("auth_token")}` }
          });
          if (res.ok) {
            Swal.fire("Berhasil", "Data telah dihapus", "success");
            loadData();
          }
        } catch (err) {
          Swal.fire("Error", "Gagal menghapus data", "error");
        }
      }
    });
  };

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
        Swal.fire("Gagal", "Format file tidak sesuai.", "error");
      }
    } catch (err) {
      Swal.fire("Error", "Koneksi terputus.", "error");
    } finally {
      setLoading(false);
    }
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
        Swal.fire("Updated", `Izin ${status}`, "success");
        loadData();
      } else {
        Swal.fire("Ditolak", "Bukan wewenang Anda.", "error");
      }
    } catch (err) {
      Swal.fire("Gagal", "Error sistem.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans bg-batik">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[24px] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">
            <span className="text-red-600">SANPIO</span> {userRole?.replace("_", " ")}
          </h1>
          <p className="text-slate-400 font-medium text-xs tracking-widest uppercase">Petugas: {userName}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="bg-slate-100 p-3 rounded-xl hover:bg-slate-200 transition">🔄</button>
          <button onClick={handleLogout} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl font-bold hover:bg-red-600 hover:text-white transition">🚪 KELUAR</button>
        </div>
      </header>

      {/* Navigasi Tab */}
      <div className="flex gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm w-fit border border-slate-100">
        {[
          { id: "guru", label: "Pegawai" },
          { id: "rekap", label: "Kehadiran" },
          { id: "izin", label: "Izin" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-2 px-6 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${
              activeTab === tab.id ? "bg-red-600 text-white shadow-lg shadow-red-100" : "text-slate-400 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: DATA GURU */}
      {activeTab === "guru" && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-center">
             <h2 className="font-black text-slate-800 uppercase tracking-tighter text-xl">Daftar Guru & Staff</h2>
             <button onClick={() => router.push("/admin/pegawai/tambah")} className="bg-slate-800 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-black transition">+ TAMBAH MANUAL</button>
          </div>

          {userRole === "super_admin" && (
            <div className="bg-white p-6 rounded-[24px] shadow-sm border border-blue-50">
              <form onSubmit={handleImport} className="flex flex-col md:flex-row gap-4">
                <input type="file" accept=".xlsx, .xls" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 transition" />
                <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-blue-700 disabled:bg-slate-300">
                  {loading ? "..." : "IMPORT EXCEL"}
                </button>
              </form>
            </div>
          )}

          <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] font-black tracking-[0.2em] border-b">
                <tr>
                  <th className="p-6">Data Pegawai</th>
                  <th className="p-6">Unit</th>
                  <th className="p-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {gurus.map((g: any) => (
                  <tr key={g.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-6">
                      <div className="font-black text-slate-800 uppercase text-sm">{g.nama_lengkap}</div>
                      <div className="text-[10px] font-mono text-slate-400">NIP. {g.nip || g.nuptk || "—"}</div>
                    </td>
                    <td className="p-6">
                        <span className="px-3 py-1 rounded-full text-[9px] font-black bg-red-50 text-red-600 uppercase border border-red-100">
                            {g.jenjang}
                        </span>
                    </td>
                    <td className="p-6">
                       <div className="flex justify-center gap-2">
                          <button onClick={() => router.push(`/admin/pegawai/edit/${g.id}`)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition text-xs">✏️</button>
                          <button onClick={() => handleHapusGuru(g.id, g.nama_lengkap)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-xs">🗑️</button>
                       </div>
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
        <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-2">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] font-black tracking-[0.2em] border-b">
              <tr>
                <th className="p-6">Waktu</th>
                <th className="p-6">Nama</th>
                <th className="p-4 text-center">Biometrik</th>
                <th className="p-6 text-center">Lokasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {rekap.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50 transition">
                  <td className="p-6">
                    <div className="font-bold text-slate-800">{new Date(r.created_at).toLocaleDateString('id-ID')}</div>
                    <div className="text-red-500 font-black text-[10px]">{new Date(r.created_at).toLocaleTimeString()}</div>
                  </td>
                  <td className="p-6 font-bold text-slate-700 uppercase">{r.nama_lengkap}</td>
                  <td className="p-4">
                    <img src={`https://backendabsen.mejatika.com/storage/${r.foto_wajah}`} className="w-10 h-10 object-cover rounded-lg border shadow-sm mx-auto" alt="Face" />
                  </td>
                  <td className="p-6 text-center">
                    <a href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} target="_blank" className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-600 hover:text-white transition">📍 MAPS</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: IZIN */}
      {activeTab === "izin" && (
        <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[9px] font-black tracking-[0.2em] border-b">
              <tr>
                <th className="p-6">Pegawai</th>
                <th className="p-6">Alasan</th>
                <th className="p-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {izins.map((i: any) => (
                <tr key={i.id} className="hover:bg-slate-50 transition">
                  <td className="p-6">
                    <div className="font-bold text-slate-800 uppercase text-xs">{i.nama_lengkap}</div>
                    <div className="text-[9px] text-blue-500 font-black uppercase tracking-tighter">{i.jenis}</div>
                  </td>
                  <td className="p-6 text-xs text-slate-500 italic">"{i.keterangan}"</td>
                  <td className="p-6">
                    <div className="flex justify-center gap-2">
                      {i.status === "Pending" ? (
                        <>
                          <button onClick={() => updateStatusIzin(i.id, "Disetujui")} className="bg-green-500 text-white px-4 py-1.5 rounded-lg text-[9px] font-black hover:bg-green-600">SETUJU</button>
                          <button onClick={() => updateStatusIzin(i.id, "Ditolak")} className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-[9px] font-black hover:bg-red-600">TOLAK</button>
                        </>
                      ) : (
                        <span className={`text-[10px] font-black uppercase ${i.status === 'Disetujui' ? 'text-green-600' : 'text-red-600'}`}>{i.status}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style jsx global>{`
        .bg-batik {
          background-image: url("https://www.transparenttextures.com/patterns/batik.png");
          background-attachment: fixed;
        }
      `}</style>
    </div>
  );
}
