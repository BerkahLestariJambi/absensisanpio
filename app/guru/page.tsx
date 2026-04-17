"use client";
import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Mengambil ID dari URL dengan fallback yang lebih aman
  const guruIdFromUrl = useMemo(() => {
    return searchParams.get("id") || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null);
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState("home");
  const [profile, setProfile] = useState<any>(null);
  const [myRekap, setMyRekap] = useState<any[]>([]);
  const [myIzin, setMyIzin] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State Filter
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const [formIzin, setFormIzin] = useState({ 
    jenis: "Izin", keterangan: "", tanggal_mulai: "", tanggal_selesai: "", file: null as any 
  });
  
  const API_URL = "https://backendabsen.mejatika.com/api";

  const loadData = async () => {
    try {
      setLoading(true);
      if (!guruIdFromUrl) {
        const token = localStorage.getItem("auth_token");
        if (!token) { router.push("/"); return; }
      }

      // 1. Ambil Profil & Status
      const resStatus = await fetch(`${API_URL}/cek-status-absen/${guruIdFromUrl}`);
      const statusJson = await resStatus.json();

      if (statusJson.success) {
        setProfile({ nama_lengkap: statusJson.nama || "Guru" });

        // 2. Ambil Rekap Absensi
        const resRekap = await fetch(`${API_URL}/admin/rekap-absensi`);
        const rekapJson = await resRekap.json();
        const allData = Array.isArray(rekapJson) ? rekapJson : (rekapJson.data || []);
        
        // Filter data milik guru yang sedang login
        const rawData = allData.filter((item: any) => String(item.guru_id) === String(guruIdFromUrl));

        // Grouping Data per Hari agar Masuk & Pulang berada dalam 1 baris tabel
        const grouped = rawData.reduce((acc: any, curr: any) => {
          const dateObj = new Date(curr.waktu_absen);
          // Gunakan format YYYY-MM-DD sebagai key unik
          const dateKey = dateObj.toISOString().split('T')[0];
          
          if (!acc[dateKey]) {
            acc[dateKey] = { 
              tanggalFormat: dateObj.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' }), 
              masuk: null, 
              pulang: null,
              statusMasuk: "-", 
              statusPulang: "-",
              lokasiMasuk: "-", 
              lokasiPulang: "-",
              rawDate: dateObj,
              isSpecialStatus: false 
            };
          }
          
          const st = curr.status.toLowerCase();
          const lokasiTxt = curr.keterangan_lokasi || "Lokasi tidak tercatat";
          const specialKeywords = ['sakit', 'izin', 'cuti', 'dinas'];
          const isSpecial = specialKeywords.some(key => st.includes(key));

          if (isSpecial) {
            acc[dateKey].statusMasuk = curr.status.toUpperCase();
            acc[dateKey].lokasiMasuk = lokasiTxt;
            acc[dateKey].isSpecialStatus = true;
          } 
          else if (st.includes('masuk') || st.includes('terlambat')) {
            acc[dateKey].masuk = curr;
            acc[dateKey].statusMasuk = curr.status.toUpperCase();
            acc[dateKey].lokasiMasuk = lokasiTxt;
          } 
          else if (st.includes('pulang')) {
            acc[dateKey].pulang = curr;
            acc[dateKey].statusPulang = curr.status.toUpperCase();
            acc[dateKey].lokasiPulang = lokasiTxt;
          }
          return acc;
        }, {});

        // Sortir dari tanggal terbaru
        setMyRekap(Object.values(grouped).sort((a: any, b: any) => b.rawDate.getTime() - a.rawDate.getTime()));

        // 3. Ambil Daftar Izin
        const resIzin = await fetch(`${API_URL}/admin/daftar-izin`);
        const izinJson = await resIzin.json();
        const allIzin = Array.isArray(izinJson) ? izinJson : (izinJson.data || []);
        setMyIzin(allIzin.filter((i: any) => String(i.guru_id) === String(guruIdFromUrl)).reverse());
      }
    } catch (err) {
      console.error("Gagal sinkronisasi data.", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (guruIdFromUrl) loadData(); }, [guruIdFromUrl]);

  const filteredRekap = useMemo(() => {
    return myRekap.filter(r => {
      const d = new Date(r.rawDate);
      return d.getMonth() + 1 === Number(filterMonth) && d.getFullYear() === Number(filterYear);
    });
  }, [myRekap, filterMonth, filterYear]);

  const stats = useMemo(() => {
    return {
      hadir: filteredRekap.filter(r => r.statusMasuk === 'MASUK').length,
      terlambat: filteredRekap.filter(r => r.statusMasuk.includes('TERLAMBAT')).length,
      izin: filteredRekap.filter(r => r.isSpecialStatus).length,
    };
  }, [filteredRekap]);

  const handleIzinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("guru_id", guruIdFromUrl || "");
    formData.append("jenis", formIzin.jenis);
    formData.append("keterangan", formIzin.keterangan);
    
    if (formIzin.jenis !== "Sakit") {
        if (formIzin.tanggal_mulai) formData.append("tanggal_mulai", formIzin.tanggal_mulai);
        if (formIzin.tanggal_selesai) formData.append("tanggal_selesai", formIzin.tanggal_selesai);
    } else {
        // Jika sakit biasanya satu hari, atau bisa disesuaikan dengan kebutuhan API
        const today = new Date().toISOString().split('T')[0];
        formData.append("tanggal_mulai", today);
        formData.append("tanggal_selesai", today);
    }
    
    if (formIzin.file) formData.append("foto_bukti", formIzin.file);

    Swal.fire({ title: "Mengirim...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
      const res = await fetch(`${API_URL}/pengajuan-izin`, { 
        method: "POST", 
        body: formData,
        headers: { 'Accept': 'application/json' } 
      });
      const result = await res.json();
      if (res.ok && result.success) {
        Swal.fire("Berhasil", "Pengajuan berhasil dikirim!", "success");
        setFormIzin({ jenis: "Izin", keterangan: "", tanggal_mulai: "", tanggal_selesai: "", file: null });
        loadData();
      } else { 
        Swal.fire("Gagal", result.message || "Periksa kembali data Anda", "error"); 
      }
    } catch (err) { 
      Swal.fire("Error", "Masalah pada server.", "error"); 
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#fdf5e6] font-black text-slate-400 uppercase tracking-widest animate-pulse">
      Sinkronisasi Database...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fdf5e6] p-4 md:p-8 bg-batik animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <header className="mb-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-6 rounded-[30px] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg uppercase">
              {profile?.nama_lengkap?.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">{profile?.nama_lengkap}</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono italic">Database ID: {guruIdFromUrl}</p>
            </div>
          </div>
          <button onClick={() => router.push("/")} className="bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-xl transition active:scale-95">🏠 Mesin Absen</button>
        </header>

        {/* NAVIGATION & STATS */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <nav className="flex gap-2 bg-white/50 p-2 rounded-2xl w-fit border border-white">
                <button onClick={() => setActiveTab("home")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'home' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>🏠 Riwayat Absen</button>
                <button onClick={() => setActiveTab("izin")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'izin' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400'}`}>✉️ Pengajuan Izin</button>
            </nav>

            {activeTab === "home" && (
                <div className="flex gap-4">
                    <div className="bg-green-500 text-white px-4 py-2 rounded-2xl shadow-sm">
                        <p className="text-[7px] font-bold uppercase opacity-80">Hadir</p>
                        <p className="text-sm font-black">{stats.hadir}</p>
                    </div>
                    <div className="bg-orange-500 text-white px-4 py-2 rounded-2xl shadow-sm">
                        <p className="text-[7px] font-bold uppercase opacity-80">Terlambat</p>
                        <p className="text-sm font-black">{stats.terlambat}</p>
                    </div>
                    <div className="bg-purple-500 text-white px-4 py-2 rounded-2xl shadow-sm">
                        <p className="text-[7px] font-bold uppercase opacity-80">Izin/Sakit</p>
                        <p className="text-sm font-black">{stats.izin}</p>
                    </div>
                </div>
            )}
        </div>

        {activeTab === "home" ? (
          <div className="space-y-4">
            {/* FILTER TABLE */}
            <div className="bg-white/90 backdrop-blur-md p-6 rounded-[24px] border border-slate-100 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-2 items-center">
                    <label className="text-[9px] font-black uppercase text-slate-400">Periode:</label>
                    <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-red-500 transition">
                        {Array.from({length: 12}, (_, i) => (
                            <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', {month: 'long'})}</option>
                        ))}
                    </select>
                    <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-red-500 transition">
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <button onClick={() => window.print()} className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-4 py-2 rounded-xl hover:bg-slate-200 transition">🖨️ Cetak Laporan</button>
            </div>

            {/* TABLE */}
            <div className="bg-white/90 backdrop-blur-md rounded-[32px] shadow-xl border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse">
                    <thead className="bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest">
                    <tr>
                        <th rowSpan={2} className="p-5 text-left border-r border-slate-700">Tanggal</th>
                        <th rowSpan={2} className="p-5 border-r border-slate-700">Jam Masuk</th>
                        <th rowSpan={2} className="p-5 border-r border-slate-700">Jam Pulang</th>
                        <th colSpan={2} className="p-3 border-b border-slate-700 border-r border-slate-700 bg-slate-700">Status Kehadiran</th>
                        <th rowSpan={2} className="p-5 text-left">Detail Lokasi & Keterangan</th>
                    </tr>
                    <tr className="bg-slate-700/50">
                        <th className="p-3 border-r border-slate-600">Status Masuk</th>
                        <th className="p-3 border-r border-slate-600">Status Pulang</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-[11px] font-bold">
                    {filteredRekap.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition group">
                        <td className="p-5 text-left border-r border-slate-100">
                            <span className="block font-black text-slate-800">{r.tanggalFormat}</span>
                            <span className="text-[8px] text-slate-400 uppercase tracking-tighter">{new Date(r.rawDate).toLocaleDateString('id-ID', {weekday: 'long'})}</span>
                        </td>
                        <td className="p-5 text-slate-600 border-r border-slate-50">
                            {(r.masuk && !r.isSpecialStatus) ? (
                                <span className="bg-slate-100 px-2 py-1 rounded-md text-slate-800 font-mono">
                                    {new Date(r.masuk.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
                                </span>
                            ) : '-'}
                        </td>
                        <td className="p-5 text-slate-600 border-r border-slate-100">
                            {(r.pulang && !r.isSpecialStatus) ? (
                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-mono border border-blue-100">
                                    {new Date(r.pulang.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
                                </span>
                            ) : (
                                <span className="text-slate-300 italic text-[9px]">{r.isSpecialStatus ? '-' : 'Belum Absen'}</span>
                            )}
                        </td>
                        <td className="p-5 border-r border-slate-50">
                            <span className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase shadow-sm ${
                                r.statusMasuk.includes('TERLAMBAT') ? 'bg-orange-100 text-orange-600 border border-orange-200' : 
                                r.isSpecialStatus ? 'bg-purple-100 text-purple-600 border border-purple-200' :
                                r.statusMasuk === '-' ? 'text-slate-300' : 'bg-green-100 text-green-600 border border-green-200'
                            }`}>
                            {r.statusMasuk}
                            </span>
                        </td>
                        <td className="p-5 border-r border-slate-100">
                            <span className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase shadow-sm ${
                                r.statusPulang === '-' ? 'text-slate-300' : 'bg-blue-100 text-blue-600 border border-blue-200'
                            }`}>
                            {r.statusPulang}
                            </span>
                        </td>
                        <td className="p-5 text-left min-w-[300px]">
                            <div className="flex flex-col gap-2">
                            {(r.masuk || r.isSpecialStatus) && (
                                <div className={`p-3 rounded-2xl border-l-4 transition ${r.isSpecialStatus ? 'bg-purple-50/50 border-purple-500' : 'bg-slate-50 border-red-500 group-hover:bg-white'}`}>
                                <p className="text-[7px] text-slate-400 uppercase font-black mb-1">{r.isSpecialStatus ? '📋 Keterangan Izin/Sakit:' : '📍 Titik Koordinat Masuk:'}</p>
                                <p className="text-[9px] leading-tight text-slate-600 font-medium italic">"{r.lokasiMasuk}"</p>
                                </div>
                            )}
                            {r.pulang && !r.isSpecialStatus && (
                                <div className="bg-blue-50/50 p-3 rounded-2xl border-l-4 border-blue-500 transition group-hover:bg-white">
                                <p className="text-[7px] text-blue-400 uppercase font-black mb-1">📍 Titik Koordinat Pulang:</p>
                                <p className="text-[9px] leading-tight text-blue-600 font-medium italic">"{r.lokasiPulang}"</p>
                                </div>
                            )}
                            </div>
                        </td>
                        </tr>
                    ))}
                    {filteredRekap.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-20 text-center">
                                <div className="flex flex-col items-center gap-2 opacity-20">
                                    <span className="text-4xl">📂</span>
                                    <p className="text-[10px] font-black uppercase tracking-widest">Tidak ada data absensi pada periode ini</p>
                                </div>
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom duration-500">
              <div className="bg-white/90 p-8 rounded-[32px] shadow-xl border border-slate-100">
                <h2 className="text-[11px] font-black uppercase text-slate-800 mb-6 tracking-widest border-l-4 border-red-600 pl-4">Formulir Pengajuan</h2>
                <form onSubmit={handleIzinSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Jenis Absensi</label>
                    <select value={formIzin.jenis} onChange={e => setFormIzin({...formIzin, jenis: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-red-600 transition">
                      <option value="Izin">Izin</option>
                      <option value="Sakit">Sakit</option>
                      <option value="Cuti">Cuti</option>
                      <option value="Dinas Luar">Dinas Luar</option>
                    </select>
                  </div>
                  {formIzin.jenis !== "Sakit" && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Dari Tanggal <span className="text-red-500">*</span></label>
                        <input type="date" required value={formIzin.tanggal_mulai} onChange={e => setFormIzin({...formIzin, tanggal_mulai: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold ring-1 ring-slate-100 outline-none focus:ring-2 focus:ring-red-600"/>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Sampai Tanggal <span className="text-red-500">*</span></label>
                        <input type="date" required value={formIzin.tanggal_selesai} onChange={e => setFormIzin({...formIzin, tanggal_selesai: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold ring-1 ring-slate-100 outline-none focus:ring-2 focus:ring-red-600"/>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Alasan / Keterangan <span className="text-red-500">*</span></label>
                    <textarea required value={formIzin.keterangan} onChange={e => setFormIzin({...formIzin, keterangan: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold h-24 outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-red-600" placeholder={formIzin.jenis === "Sakit" ? "Jelaskan kondisi sakit Anda..." : "Tuliskan alasan lengkap..."}/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Foto Bukti (Dokumen/Surat)</label>
                    <input type="file" accept="image/*,.pdf" onChange={e => setFormIzin({...formIzin, file: e.target.files?.[0]})} className="w-full p-3 bg-slate-50 rounded-2xl text-[10px] font-bold ring-1 ring-slate-100"/>
                  </div>
                  <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg hover:bg-red-700 transition active:scale-95">Kirim Ke Admin</button>
                </form>
              </div>

              <div className="bg-white/90 p-8 rounded-[32px] shadow-xl border border-slate-100 h-fit">
                <h2 className="text-[11px] font-black uppercase text-slate-800 mb-6 tracking-widest border-l-4 border-slate-800 pl-4">Status Pengajuan Anda</h2>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {myIzin.map((izin: any, idx: number) => (
                    <div key={idx} className="p-5 bg-slate-50 rounded-[24px] border border-slate-100 hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[8px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${izin.status === 'Disetujui' ? 'bg-green-100 text-green-600' : izin.status === 'Ditolak' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                          {izin.status || 'DALAM PROSES'}
                        </span>
                        <p className="text-[8px] text-slate-400 font-bold">{new Date(izin.created_at).toLocaleDateString('id-ID')}</p>
                      </div>
                      <p className="text-
