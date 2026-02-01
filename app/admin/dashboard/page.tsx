"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("rekap");
  const [subTabIzin, setSubTabIzin] = useState("Semua");
  const [gurus, setGurus] = useState([]);
  const [izins, setIzins] = useState([]);
  const [rekap, setRekap] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [schoolName, setSchoolName] = useState("Memuat...");
  const [schoolLogo, setSchoolLogo] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState(null);

  const API_URL = "https://backendabsen.mejatika.com/api";

  // --- LOGIKA FILTERING & BADGE ---
  const getPendingCount = (jenis) => {
    if (jenis === "Semua") return izins.filter((i) => i.status === "Pending").length;
    return izins.filter((i) => i.jenis === jenis && i.status === "Pending").length;
  };

  const filteredIzins = subTabIzin === "Semua" 
    ? izins 
    : izins.filter((i) => i.jenis === subTabIzin);

  // --- LOAD DATA ---
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
      const grouped = rawRekap.reduce((acc, curr) => {
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

  // --- ACTIONS ---
  const handleLogout = () => {
    localStorage.clear();
    router.push("/admin/login");
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    Swal.fire({ title: "Mengunggah...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await fetch(`${API_URL}/admin/guru/import`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("auth_token")}` },
        body: formData
      });
      if (res.ok) {
        Swal.fire("Berhasil", "Data pegawai berhasil diimport!", "success");
        loadData();
      } else {
        const result = await res.json();
        Swal.fire("Gagal", result.message || "Format file salah", "error");
      }
    } catch (err) {
      Swal.fire("Error", "Gagal menghubungi server", "error");
    }
  };

  const updateStatusIzin = async (id, status) => {
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
            {tab.id === "izin" && getPendingCount("Semua") > 0 && (
                <span className="bg-white text-red-600 px-1.5 py-0.5 rounded-md text-[8px] animate-pulse">
                    {getPendingCount("Semua")}
                </span>
            )}
          </button>
        ))}
      </nav>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* TAB PEGAWAI */}
        {activeTab === "guru" && (
          <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                  <div>
                    <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest ml-2">Manajemen Data Pegawai</h2>
                    <p className="text-[10px] text-slate-400 ml-2 font-bold italic">Total: {gurus.length} Orang</p>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <label className="cursor-pointer bg-green-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black hover:bg-green-700 transition shadow-lg flex items-center gap-2">
                      📥 IMPORT EXCEL
                      <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportExcel} />
                    </label>
                    <button onClick={() => router.push("/admin/pegawai/tambah")} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black hover:scale-105 transition shadow-lg flex items-center gap-2">+ TAMBAH GURU</button>
                  </div>
              </div>
              
              <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-800 text-white uppercase text-[9px] font-black tracking-widest">
                    <tr>
                      <th className="p-6">Informasi Pegawai</th>
                      <th className="p-6">NIP/NUPTK</th>
                      <th className="p-6 text-center">Status</th>
                      <th className="p-6 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {gurus.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50 transition">
                        <td className="p-6">
                          <div className="font-black text-slate-800 uppercase text-xs">{g.nama_lengkap}</div>
                          <div className="text-[9px] font-bold text-red-600 uppercase italic">{g.jenjang}</div>
                        </td>
                        <td className="p-6 text-xs font-bold text-slate-500">{g.nip || '-'} / {g.nuptk || '-'}</td>
                        <td className="p-6 text-center">
                          <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[9px] font-black uppercase">Aktif</span>
                        </td>
                        <td className="p-6 text-center">
                          <button onClick={() => router.push(`/admin/pegawai/edit/${g.id}`)} className="bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 transition p-2 rounded-lg text-[10px] font-black">✏️ EDIT</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>
        )}

        {/* TAB KEHADIRAN (REKAP 1 BARIS) */}
        {activeTab === "rekap" && (
          <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Rekap Absensi Harian</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">1 Baris Per Pegawai / Hari</p>
                </div>
                <span className="bg-red-100 text-red-600 text-[9px] font-black px-3 py-1 rounded-full uppercase italic">Zona Waktu: WITA</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800 text-white uppercase text-[9px] font-black tracking-widest">
                  <tr>
                    <th rowSpan={2} className="p-6 text-left border-r border-slate-700">Pegawai</th>
                    <th rowSpan={2} className="p-6 text-center border-r border-slate-700">Tanggal</th>
                    <th colSpan={2} className="p-4 text-center border-b border-slate-700">Jam & Status Scan</th>
                    <th rowSpan={2} className="p-6 text-center">Lokasi</th>
                  </tr>
                  <tr>
                    <th className="p-4 text-center border-r border-slate-700 bg-slate-800 text-red-400">Masuk</th>
                    <th className="p-4 text-center border-r border-slate-700 bg-slate-800 text-blue-400">Pulang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rekap.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition text-xs font-medium">
                      <td className="p-6 border-r">
                        <div className="flex items-center gap-3">
                           <img src={(r.data_masuk?.foto_wajah || r.data_pulang?.foto_wajah) ? `https://backendabsen.mejatika.com/storage/${r.data_masuk?.foto_wajah || r.data_pulang?.foto_wajah}` : '/no-avatar.png'} className="w-10 h-10 object-cover rounded-xl border border-slate-200" alt="F" />
                           <div>
                              <div className="font-black text-slate-800 uppercase text-xs">{r.nama_lengkap}</div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase">{r.nip || 'No NIP'}</div>
                           </div>
                        </div>
                      </td>
                      <td className="p-6 text-center border-r font-bold text-slate-700 uppercase">
                           {new Date(r.waktu_absen).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})}
                      </td>
                      <td className="p-4 text-center border-r min-w-[130px]">
                        {r.data_masuk ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-black text-slate-700">{new Date(r.data_masuk.waktu_absen).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${r.data_masuk.status.includes('Terlambat') ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-700'}`}>{r.data_masuk.status}</span>
                          </div>
                        ) : <span className="text-slate-200 text-[10px] font-black italic">BELUM SCAN</span>}
                      </td>
                      <td className="p-4 text-center border-r min-w-[130px]">
                        {r.data_pulang ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-black text-blue-700">{new Date(r.data_pulang.waktu_absen).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-blue-100 text-blue-700">{r.data_pulang.status}</span>
                          </div>
                        ) : <span className="text-slate-200 text-[10px] font-black italic">BELUM SCAN</span>}
                      </td>
                      <td className="p-6 text-center">
                          <a href={`https://www.google.com/maps?q=${r.data_masuk?.latitude || r.data_pulang?.latitude},${r.data_masuk?.longitude || r.data_pulang?.longitude}`} target="_blank" className="inline-block w-7 h-7 leading-7 bg-slate-100 rounded-lg text-sm hover:bg-red-600 hover:text-white transition">📍</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB IZIN & SAKIT (DENGAN TANGGAL MULAI/SELESAI) */}
        {activeTab === "izin" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-2">
              {["Semua", "Izin", "Sakit", "Cuti", "Tugas Luar"].map((type) => (
                <button
                  key={type}
                  onClick={() => setSubTabIzin(type)}
                  className={`relative py-3 px-6 rounded-2xl text-[9px] font-black uppercase transition-all border ${
                    subTabIzin === type ? "bg-slate-800 text-white border-slate-800 shadow-lg" : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  {type}
                  {getPendingCount(type) > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[9px] animate-bounce border-2 border-white">{getPendingCount(type)}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800 text-white uppercase text-[9px] font-black tracking-widest">
                    <tr>
                      <th className="p-6 text-left">Nama Pegawai</th>
                      <th className="p-6 text-left">Jenis & Rentang Waktu</th>
                      <th className="p-6 text-center">Lampiran</th>
                      <th className="p-6 text-center">Status</th>
                      <th className="p-6 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredIzins.map((i) => (
                      <tr key={i.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-6">
                          <div className="font-black text-slate-800 uppercase text-xs">{i.nama_lengkap}</div>
                          <div className="text-[9px] text-slate-400 font-bold italic">Request: {new Date(i.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="p-6 text-xs">
                          <span className={`font-black px-2 py-0.5 rounded uppercase mb-1 inline-block ${i.jenis === 'Sakit' ? 'bg-amber-100 text-amber-600' : i.jenis === 'Tugas Luar' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{i.jenis}</span>
                          
                          {/* LOGIKA TANGGAL MULAI - SELESAI */}
                          <div className="flex flex-col gap-1 mt-1">
                             <div className="text-slate-800 font-black text-[10px] uppercase">
                                📅 {i.tanggal_mulai ? (
                                  <>
                                    {new Date(i.tanggal_mulai).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})} 
                                    {i.tanggal_selesai && ` s/d ${new Date(i.tanggal_selesai).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})}`}
                                  </>
                                ) : (
                                  <span className="text-slate-400 italic">Tanggal tidak terdata</span>
                                )}
                             </div>
                             <div className="text-slate-500 font-medium italic">"{i.keterangan}"</div>
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          {i.foto_bukti ? (
                            <button onClick={() => window.open(`https://backendabsen.mejatika.com/storage/${i.foto_bukti}`)} className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[9px] font-black hover:bg-red-600 hover:text-white transition uppercase">Lihat Bukti</button>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-6 text-center">
                           <span className={`text-[9px] font-black px-3 py-1 rounded-full border uppercase ${i.status === 'Disetujui' ? 'bg-green-50 text-green-600 border-green-100' : i.status === 'Ditolak' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                             {i.status}
                           </span>
                        </td>
                        <td className="p-6 text-center">
                          <div className="flex justify-center gap-2">
                            {i.status === "Pending" && (
                              <>
                                <button onClick={() => updateStatusIzin(i.id, "Disetujui")} className="bg-green-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black hover:bg-green-700 transition">Setuju</button>
                                <button onClick={() => updateStatusIzin(i.id, "Ditolak")} className="bg-red-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black hover:bg-red-700 transition">Tolak</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredIzins.length === 0 && (
                      <tr><td colSpan={5} className="p-20 text-center font-bold text-slate-300 uppercase text-xs tracking-widest italic">Tidak ada data {subTabIzin}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB SETTING */}
        {activeTab === "setting" && (
            <div className="bg-white p-12 rounded-[40px] shadow-xl border border-slate-100 text-center space-y-6">
               <div className="w-24 h-24 bg-red-50 text-red-600 rounded-[30px] flex items-center justify-center text-4xl mx-auto shadow-inner rotate-3">⚙️</div>
               <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Konfigurasi Aplikasi</h2>
               <button onClick={() => router.push('/admin/setting')} className="bg-red-600 text-white px-10 py-4 rounded-[20px] font-black text-xs tracking-widest hover:bg-red-700 transition shadow-xl shadow-red-100">BUKA PANEL PENGATURAN</button>
            </div>
        )}
      </div>

      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); background-attachment: fixed; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}
