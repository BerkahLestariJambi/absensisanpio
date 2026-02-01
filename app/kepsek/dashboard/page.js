"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function KepsekDashboard() {
  const router = useRouter();
  const [izins, setIzins] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [schoolName, setSchoolName] = useState("Memuat...");
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [jenjangTujuan, setJenjangTujuan] = useState(""); // SMP atau SMA

  const API_URL = "https://backendabsen.mejatika.com/api";

  // --- LOGIKA FILTER DATA BERDASARKAN JENJANG KEPSEK ---
  // Kita filter di frontend agar lebih aman dan akurat
  const filteredIzins = izins.filter((i) => {
    if (userRole === "super_admin") return true; // Super Admin lihat semua
    if (userRole === "kepsek_smp") return i.guru?.jenjang === "SMP";
    if (userRole === "kepsek_sma") return i.guru?.jenjang === "SMA";
    return false;
  });

  const countPending = filteredIzins.filter(i => i.status === "Pending").length;

  const fetchData = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return router.push("/admin/login");

    setLoading(true);
    try {
      const headers = { 
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      };
      
      const [resIzin, resStats, resSetting] = await Promise.all([
        fetch(`${API_URL}/admin/daftar-izin`, { headers }),
        fetch(`${API_URL}/admin/pengajuan/stats`, { headers }),
        fetch(`${API_URL}/setting-app`)
      ]);

      const dataIzin = await resIzin.json();
      const dataStats = await resStats.json();
      const dataSetting = await resSetting.json();

      // Ambil data mentah (nanti di filter oleh fungsi filteredIzins di atas)
      setIzins(Array.isArray(dataIzin) ? dataIzin : dataIzin.data || []);
      
      // Statistik dari server (opsional, kita bisa pakai countPending hasil filter frontend)
      setPendingCount(dataStats.pending_count || 0);
      
      if (dataSetting.success) setSchoolName(dataSetting.data.nama_sekolah);
    } catch (err) {
      console.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    const name = localStorage.getItem("user_name");
    
    if (!role || (!role.includes('kepsek') && role !== 'super_admin')) {
      router.push("/admin/login");
    } else {
      setUserRole(role);
      setUserName(name);
      setJenjangTujuan(role === "kepsek_smp" ? "SMP" : "SMA");
      fetchData();
    }
  }, []);

  const handleAction = async (id, status) => {
    const confirm = await Swal.fire({
      title: `Konfirmasi ${status}?`,
      text: `Apakah Anda yakin ingin ${status} pengajuan ini?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: status === 'Disetujui' ? '#059669' : '#dc2626',
      confirmButtonText: `Ya, ${status}!`
    });

    if (confirm.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/admin/izin/${id}/status`, {
          method: "PATCH",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("auth_token")}` 
          },
          body: JSON.stringify({ status })
        });
        if (res.ok) {
          Swal.fire("Berhasil", `Pengajuan telah ${status}`, "success");
          fetchData();
        }
      } catch (err) {
        Swal.fire("Gagal", "Sistem sibuk.", "error");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans bg-batik">
      <div className="max-w-7xl mx-auto p-4 lg:p-10">
        
        {/* HEADER KHUSUS KEPSEK */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-red-600 rounded-[22px] flex items-center justify-center text-3xl shadow-xl shadow-red-100 rotate-3">
              👨‍🏫
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">
                PANEL <span className="text-red-600">{userRole?.replace("_", " ")}</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                {schoolName} — Petugas: {userName}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={fetchData} className="bg-slate-100 p-4 rounded-2xl hover:bg-slate-200 transition">🔄</button>
             <button onClick={() => { localStorage.clear(); router.push("/admin/login"); }} className="bg-red-50 text-red-600 px-8 py-3 rounded-2xl font-black text-xs hover:bg-red-600 hover:text-white transition border border-red-100 uppercase tracking-widest">Keluar</button>
          </div>
        </header>

        {/* STATS AREA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 text-9xl opacity-5 group-hover:scale-110 transition-transform">🏢</div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Wilayah Kerja</p>
            <h3 className="text-3xl font-black text-slate-800">JENJANG {userRole === 'super_admin' ? 'SEMUA' : jenjangTujuan}</h3>
          </div>
          
          <div className="bg-red-600 p-8 rounded-[40px] shadow-xl shadow-red-100 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 text-9xl opacity-10 group-hover:rotate-12 transition-transform">✉️</div>
            <p className="text-[10px] font-black text-red-200 uppercase tracking-widest mb-1">Perlu Persetujuan</p>
            <h3 className="text-5xl font-black text-white">{countPending} <span className="text-sm font-bold opacity-80 uppercase tracking-normal">Guru</span></h3>
          </div>
        </div>

        {/* TABEL PENGELOLAAN IZIN */}
        <div className="bg-white rounded-[45px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
             <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm flex items-center gap-3">
               <span className="w-2 h-6 bg-red-600 rounded-full"></span> 
               Antrian Izin & Sakit (Jenjang {jenjangTujuan})
             </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800 text-white uppercase text-[9px] font-black tracking-[0.2em]">
                <tr>
                  <th className="p-6 text-left">Data Pegawai</th>
                  <th className="p-6 text-left">Alasan & Durasi</th>
                  <th className="p-6 text-center">Lampiran</th>
                  <th className="p-6 text-center">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredIzins.filter(i => i.status === 'Pending').map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-6">
                      <div className="font-black text-slate-800 uppercase text-xs">{i.guru?.nama_lengkap}</div>
                      <div className="text-[9px] text-red-600 font-bold uppercase mt-0.5">{i.guru?.nip || 'TANPA NIP'}</div>
                    </td>
                    <td className="p-6">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase mb-1 inline-block ${i.jenis === 'Sakit' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>{i.jenis}</span>
                      <div className="text-[11px] font-black text-slate-700">
                        {new Date(i.tanggal_mulai).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})} 
                        {i.tanggal_selesai ? ` s/d ${new Date(i.tanggal_selesai).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})}` : " (Hingga Sembuh)"}
                      </div>
                      <p className="text-[10px] text-slate-400 italic mt-1 font-medium">"{i.keterangan}"</p>
                    </td>
                    <td className="p-6 text-center">
                      {i.foto_bukti ? (
                        <button onClick={() => window.open(`https://backendabsen.mejatika.com/storage/${i.foto_bukti}`)} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl text-[9px] font-black hover:bg-red-600 hover:text-white transition uppercase">Cek Bukti</button>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="p-6">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleAction(i.id, 'Disetujui')} className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-[9px] font-black hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition">SETUJUI</button>
                        <button onClick={() => handleAction(i.id, 'Ditolak')} className="bg-red-600 text-white px-5 py-2.5 rounded-2xl text-[9px] font-black hover:bg-red-700 shadow-lg shadow-red-100 transition">TOLAK</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredIzins.filter(i => i.status === 'Pending').length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-24 text-center">
                      <div className="text-4xl mb-4">✅</div>
                      <div className="font-black text-slate-300 uppercase tracking-[0.3em] italic text-xs">Belum ada pengajuan masuk untuk jenjang {jenjangTujuan}</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); background-attachment: fixed; }
      `}</style>
    </div>
  );
}
