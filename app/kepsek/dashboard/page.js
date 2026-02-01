"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function KepsekDashboard() {
  const router = useRouter();
  const [izins, setIzins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [userJenjang, setUserJenjang] = useState(""); // State tambahan untuk jenjang kepsek

  const API_URL = "https://backendabsen.mejatika.com/api";

  /**
   * FILTER FRONTEND (Double Check)
   * Meskipun Backend sudah memfilter, kita tetap lakukan filter di sini
   * agar data yang tampil di layar benar-benar bersih.
   */
  const filteredIzins = izins.filter((item) => {
    const activeRole = userRole || localStorage.getItem("user_role");
    
    // Jika Super Admin, tampilkan semua
    if (activeRole === "super_admin") return true;

    // Ambil jenjang guru dari data pengajuan
    const jenjangGuru = item.guru?.jenjang?.toString().toUpperCase().trim();
    
    // Ambil jenjang kepsek dari state/localStorage
    const currentJenjang = userJenjang || localStorage.getItem("user_jenjang");

    return jenjangGuru === currentJenjang;
  });

  const pendingIzins = filteredIzins.filter(i => i.status === "Pending");

  const fetchData = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      router.push("/admin/login");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/daftar-izin`, {
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json",
          "Content-Type": "application/json"
        }
      });

      if (res.status === 401) {
        localStorage.clear();
        router.push("/admin/login");
        return;
      }

      const data = await res.json();
      setIzins(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error("Gagal ambil data API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    const name = localStorage.getItem("user_name");
    const jenjang = localStorage.getItem("user_jenjang"); // Pastikan ini disimpan saat login
    
    if (!role || !role.includes('kepsek')) {
      if (role !== "super_admin") {
        router.push("/admin/login");
        return;
      }
    }
    
    setUserRole(role);
    setUserName(name);
    setUserJenjang(jenjang);
    fetchData();
  }, []);

  const handleAction = async (id, status) => {
    const confirm = await Swal.fire({
      title: `Konfirmasi ${status}?`,
      text: "Data akan diperbarui di sistem.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: status === 'Disetujui' ? '#10b981' : '#ef4444',
      confirmButtonText: 'Ya, Lanjutkan!'
    });

    if (confirm.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/admin/izin/${id}/status`, {
          method: "PATCH",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
            "Accept": "application/json"
          },
          body: JSON.stringify({ status })
        });
        
        if (res.ok) {
          Swal.fire("Berhasil", `Data telah ${status}`, "success");
          fetchData();
        } else {
          Swal.fire("Gagal", "Tidak memiliki izin untuk mengubah data ini", "error");
        }
      } catch (err) {
        Swal.fire("Error", "Gagal menghubungi server", "error");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">
              PANEL {userRole?.replace("_", " ")}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
              User: {userName}
            </p>
          </div>
          <button onClick={() => { localStorage.clear(); router.push("/admin/login"); }} className="text-xs font-black text-red-500 hover:text-red-700 uppercase">Keluar</button>
        </div>

        {/* INFO FILTER AKTIF */}
        <div className="bg-blue-600 text-white p-6 rounded-3xl mb-8 flex justify-between items-center shadow-xl shadow-blue-100">
          <div>
            <p className="text-[10px] font-black uppercase opacity-70 tracking-[0.2em]">Wilayah Monitoring</p>
            <h2 className="text-2xl font-black uppercase">KHUSUS JENJANG {userJenjang || "MEMUAT..."}</h2>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black">{pendingIzins.length}</p>
            <p className="text-[9px] font-black uppercase opacity-70">Antrian Izin</p>
          </div>
        </div>

        {/* TABEL */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-20 text-center font-bold text-slate-400 animate-pulse">MENYINKRONKAN DATA...</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="p-5 text-left">Nama Guru</th>
                  <th className="p-5 text-left">Jenjang</th>
                  <th className="p-5 text-left">Alasan</th>
                  <th className="p-5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingIzins.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50 transition">
                    <td className="p-5 font-bold text-slate-700 uppercase text-xs">{i.guru?.nama_lengkap}</td>
                    <td className="p-5">
                      <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[9px] font-black">{i.guru?.jenjang}</span>
                    </td>
                    <td className="p-5">
                      <p className="text-xs text-slate-600 font-medium italic">"{i.keterangan}"</p>
                      <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">{i.jenis} • {i.tanggal_mulai}</p>
                    </td>
                    <td className="p-5 flex justify-center gap-2">
                      <button onClick={() => handleAction(i.id, 'Disetujui')} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 transition">Setuju</button>
                      <button onClick={() => handleAction(i.id, 'Ditolak')} className="bg-red-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-600 transition">Tolak</button>
                    </td>
                  </tr>
                ))}
                
                {pendingIzins.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-20 text-center font-black text-slate-300 uppercase italic text-sm">
                      Tidak ada pengajuan masuk untuk jenjang {userJenjang}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
