"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("rekap");
  const [subTabIzin, setSubTabIzin] = useState("Semua"); // State untuk filter kategori izin
  const [gurus, setGurus] = useState([]);
  const [izins, setIzins] = useState([]);
  const [rekap, setRekap] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [schoolName, setSchoolName] = useState("Memuat...");
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const API_URL = "https://backendabsen.mejatika.com/api";

  // --- LOGIKA FILTERING & NOTIFIKASI ---
  
  // 1. Menghitung jumlah 'Pending' untuk setiap kategori (Notifikasi)
  const getPendingCount = (jenis: string) => {
    if (jenis === "Semua") {
      return izins.filter((i: any) => i.status === "Pending").length;
    }
    return izins.filter((i: any) => i.jenis === jenis && i.status === "Pending").length;
  };

  // 2. Memfilter data yang tampil berdasarkan sub-tab yang dipilih
  const filteredIzins = subTabIzin === "Semua" 
    ? izins 
    : izins.filter((i: any) => i.jenis === subTabIzin);

  // --- DATA LOADING ---
  const loadData = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return router.push("/admin/login");

    setLoading(true);
    try {
      const headers = { 
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      };

      const [resGuru, resIzin, resRekap, resSetting] = await Promise.all([
        fetch(`${API_URL}/admin/guru`, { headers }),
        fetch(`${API_URL}/admin/daftar-izin`, { headers }),
        fetch(`${API_URL}/admin/rekap-absensi`, { headers }),
        fetch(`${API_URL}/setting-app`) 
      ]);
      
      const dataGuru = await resGuru.json();
      const dataIzin = await resIzin.json();
      const dataRekap = await resRekap.json();
      const dataSetting = await resSetting.json();

      setGurus(Array.isArray(dataGuru) ? dataGuru : dataGuru.data || []);
      setIzins(Array.isArray(dataIzin) ? dataIzin : dataIzin.data || []);
      
      const rawRekap = Array.isArray(dataRekap) ? dataRekap : dataRekap.data || [];
      const grouped = rawRekap.reduce((acc: any, curr: any) => {
        const dateKey = new Date(curr.waktu_absen).toLocaleDateString('id-ID');
        const key = `${curr.nama_lengkap}-${dateKey}`;
        if (!acc[key]) {
          acc[key] = { ...curr, data_masuk: null, data_pulang: null };
        }
        const statusLower = curr.status.toLowerCase();
        if (statusLower.includes('masuk') || statusLower.includes('terlambat')) {
          acc[key].data_masuk = curr;
        } else if (statusLower.includes('pulang')) {
          acc[key].data_pulang = curr;
        }
        return acc;
      }, {});
      setRekap(Object.values(grouped));
      
      if (dataSetting.success && dataSetting.data) {
        setSchoolName(dataSetting.data.nama_sekolah || "SANPIO");
        setSchoolLogo(dataSetting.data.logo_sekolah || null);
      }
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
      {/* HEADER SECTION - Tetap Sama */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[30px] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center shadow-inner">
            {schoolLogo ? (
              <img src={`https://backendabsen.mejatika.com/storage/${schoolLogo}`} className="w-full h-full object-contain" alt="Logo" />
            ) : (
              <span className="text-2xl">🏫</span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">
              <span className="text-red-600">{schoolName}</span> {userRole?.replace("_", " ")}
            </h1>
            <p className="text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase">Petugas: {userName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.open('/', '_blank')} className="bg-amber-50 text-amber-600 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-amber-100 transition uppercase border border-amber-100">🖥️ Buka Mesin</button>
          <button onClick={loadData} className={`bg-slate-100 p-3 rounded-xl hover:bg-slate-200 transition ${loading ? 'animate-spin' : ''}`}>🔄</button>
          <button onClick={handleLogout} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl font-black text-xs hover:bg-red-600 hover:text-white transition border border-red-100 uppercase tracking-widest">🚪 Keluar</button>
        </div>
      </header>

      {/* NAV TAB UTAMA */}
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
            {/* Notifikasi Global untuk Tab Izin */}
            {tab.id === "izin" && getPendingCount("Semua") > 0 && (
                <span className="bg-white text-red-600 px-1.5 py-0.5 rounded-md text-[8px] animate-pulse">
                    {getPendingCount("Semua")}
                </span>
            )}
          </button>
        ))}
      </nav>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* ... TAB PEGAWAI & REKAP (Sama Seperti Sebelumnya) ... */}

        {/* TAB IZIN & SAKIT - VERSI BARU DENGAN SUB-TAB */}
        {activeTab === "izin" && (
          <div className="space-y-4">
            {/* SUB-TAB NAVIGASI */}
            <div className="flex flex-wrap gap-2 mb-2">
              {["Semua", "Izin", "Sakit", "Cuti", "Tugas Luar"].map((type) => (
                <button
                  key={type}
                  onClick={() => setSubTabIzin(type)}
                  className={`relative py-3 px-6 rounded-2xl text-[9px] font-black uppercase transition-all border ${
                    subTabIzin === type 
                    ? "bg-slate-800 text-white border-slate-800 shadow-lg" 
                    : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  {type}
                  {/* BADGE NOTIFIKASI SUB-TAB */}
                  {getPendingCount(type) > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[9px] animate-bounce shadow-md border-2 border-white">
                      {getPendingCount(type)}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">
                    Daftar Pengajuan: <span className="text-red-600">{subTabIzin}</span>
                  </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800 text-white uppercase text-[9px] font-black tracking-widest">
                    <tr>
                      <th className="p-6 text-left">Nama Pegawai</th>
                      <th className="p-6 text-left">Jenis & Alasan</th>
                      <th className="p-6 text-center">Lampiran</th>
                      <th className="p-6 text-center">Status</th>
                      <th className="p-6 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredIzins.length > 0 ? filteredIzins.map((i: any) => (
                      <tr key={i.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-6">
                          {/* PERBAIKAN: Memastikan data nama muncul, bukan tanggal */}
                          <div className="font-black text-slate-800 uppercase text-xs">
                            {i.guru?.nama_lengkap || i.nama_lengkap || "Tanpa Nama"}
                          </div>
                          <div className="text-[9px] text-slate-400 font-bold italic">
                            Diajukan: {new Date(i.created_at).toLocaleDateString('id-ID')}
                          </div>
                        </td>
                        <td className="p-6 text-xs">
                          <span className={`font-black px-2 py-0.5 rounded uppercase mb-1 inline-block ${
                             i.jenis === 'Sakit' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {i.jenis}
                          </span>
                          <div className="text-slate-500 font-medium italic">"{i.keterangan}"</div>
                        </td>
                        <td className="p-6 text-center">
                          {i.foto_bukti || i.bukti_dokumen ? (
                            <button 
                                onClick={() => window.open(`https://backendabsen.mejatika.com/storage/${i.foto_bukti || i.bukti_dokumen}`)} 
                                className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[9px] font-black hover:bg-red-600 hover:text-white transition uppercase"
                            >
                                📄 Lihat Bukti
                            </button>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-6 text-center">
                            <span className={`text-[9px] font-black px-4 py-1.5 rounded-full border uppercase ${
                                i.status === 'Disetujui' ? 'bg-green-50 text-green-600 border-green-100' : 
                                i.status === 'Ditolak' ? 'bg-red-50 text-red-600 border-red-100' : 
                                'bg-amber-50 text-amber-600 border-amber-100'
                            }`}>
                                {i.status}
                            </span>
                        </td>
                        <td className="p-6 text-center">
                          <div className="flex justify-center gap-2">
                            {i.status === "Pending" && (
                              <>
                                <button onClick={() => updateStatusIzin(i.id, "Disetujui")} className="bg-green-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black hover:bg-green-700 transition uppercase shadow-md shadow-green-100">Setuju</button>
                                <button onClick={() => updateStatusIzin(i.id, "Ditolak")} className="bg-red-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black hover:bg-red-700 transition uppercase shadow-md shadow-red-100">Tolak</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="p-20 text-center font-bold text-slate-300 uppercase text-xs tracking-widest italic">Tidak ada antrian {subTabIzin}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ... TAB SETTING (Sama Seperti Sebelumnya) ... */}
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
