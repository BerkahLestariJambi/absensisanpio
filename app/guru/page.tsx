"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const guruIdFromUrl = searchParams.get("id") || (typeof window !== 'undefined' ? window.location.search.split('=')[1] : null);

  const [activeTab, setActiveTab] = useState("home");
  const [profile, setProfile] = useState<any>(null);
  const [myRekap, setMyRekap] = useState<any[]>([]);
  const [myIzin, setMyIzin] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

      // 1. Cek Status & Profil Guru
      const resStatus = await fetch(`${API_URL}/cek-status-absen/${guruIdFromUrl}`);
      const statusJson = await resStatus.json();

      if (statusJson.success) {
        setProfile({ nama_lengkap: statusJson.nama || "Guru" });

        // 2. Ambil Rekap Absensi
        const resRekap = await fetch(`${API_URL}/admin/rekap-absensi`);
        const rekapJson = await resRekap.json();
        const allData = Array.isArray(rekapJson) ? rekapJson : (rekapJson.data || []);
        
        // Filter data berdasarkan ID guru yang login
        const rawData = allData.filter((item: any) => String(item.guru_id) === String(guruIdFromUrl));

        // Grouping data berdasarkan Tanggal (agar Masuk & Pulang di baris yang sama)
        const grouped = rawData.reduce((acc: any, curr: any) => {
          const dateKey = new Date(curr.waktu_absen).toLocaleDateString('en-CA'); 
          if (!acc[dateKey]) {
            acc[dateKey] = { 
              tanggalFormat: new Date(curr.waktu_absen).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }), 
              masuk: null, pulang: null,
              statusMasuk: "-", statusPulang: "-",
              lokasiMasuk: "-", lokasiPulang: "-",
              rawDate: new Date(curr.waktu_absen)
            };
          }
          
          const st = curr.status.toLowerCase();
          const lokasiTxt = curr.keterangan_lokasi || "Lokasi tidak tercatat";

          if (st.includes('masuk') || st.includes('terlambat')) {
            acc[dateKey].masuk = curr;
            acc[dateKey].statusMasuk = curr.status.toUpperCase(); // Ambil asli dari DB
            acc[dateKey].lokasiMasuk = lokasiTxt;
          } else if (st.includes('pulang')) {
            acc[dateKey].pulang = curr;
            acc[dateKey].statusPulang = curr.status.toUpperCase(); // Ambil asli dari DB (Bukan "HADIR")
            acc[dateKey].lokasiPulang = lokasiTxt;
          }
          return acc;
        }, {});

        setMyRekap(Object.values(grouped).sort((a: any, b: any) => b.rawDate - a.rawDate));

        // 3. Ambil Daftar Izin
        const resIzin = await fetch(`${API_URL}/admin/daftar-izin`);
        const izinJson = await resIzin.json();
        const allIzin = Array.isArray(izinJson) ? izinJson : (izinJson.data || []);
        setMyIzin(allIzin.filter((i: any) => String(i.guru_id) === String(guruIdFromUrl)).reverse());
      }
    } catch (err) {
      console.error("Gagal sinkronisasi data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (guruIdFromUrl) loadData(); }, [guruIdFromUrl]);

  const handleIzinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("guru_id", guruIdFromUrl || "");
    formData.append("jenis", formIzin.jenis);
    formData.append("keterangan", formIzin.keterangan);
    if (formIzin.tanggal_mulai) formData.append("tanggal_mulai", formIzin.tanggal_mulai);
    if (formIzin.tanggal_selesai) formData.append("tanggal_selesai", formIzin.tanggal_selesai);
    if (formIzin.file) formData.append("foto_bukti", formIzin.file);

    Swal.fire({ title: "Mengirim...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await fetch(`${API_URL}/pengajuan-izin`, { method: "POST", body: formData });
      if (res.ok) {
        Swal.fire("Berhasil", "Pengajuan dikirim!", "success");
        setFormIzin({ jenis: "Izin", keterangan: "", tanggal_mulai: "", tanggal_selesai: "", file: null });
        loadData();
      } else { Swal.fire("Gagal", "Periksa kembali data Anda", "error"); }
    } catch (err) { Swal.fire("Error", "Masalah pada server.", "error"); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#fdf5e6] font-black text-slate-400 uppercase tracking-widest">Sinkronisasi Database...</div>;

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

        {/* NAVIGATION */}
        <nav className="flex gap-2 mb-6 bg-white/50 p-2 rounded-2xl w-fit border border-white">
          <button onClick={() => setActiveTab("home")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'home' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>🏠 Riwayat Absen</button>
          <button onClick={() => setActiveTab("izin")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'izin' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400'}`}>✉️ Pengajuan Izin</button>
        </nav>

        {activeTab === "home" ? (
          <div className="bg-white/90 backdrop-blur-md rounded-[32px] shadow-xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead className="bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest">
                  <tr>
                    <th rowSpan={2} className="p-5 text-left border-r border-slate-700">Tanggal</th>
                    <th rowSpan={2} className="p-5 border-r border-slate-700">Jam Masuk</th>
                    <th rowSpan={2} className="p-5 border-r border-slate-700">Jam Pulang</th>
                    <th colSpan={2} className="p-3 border-b border-slate-700 border-r border-slate-700 bg-slate-700">Status Kehadiran</th>
                    <th rowSpan={2} className="p-5 text-left">Keterangan Lokasi (Database)</th>
                  </tr>
                  <tr className="bg-slate-700/50">
                    <th className="p-3 border-r border-slate-600">Masuk</th>
                    <th className="p-3 border-r border-slate-600">Pulang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-[11px] font-bold">
                  {myRekap.length > 0 ? myRekap.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition">
                      <td className="p-5 text-left font-black text-slate-700 border-r border-slate-100">{r.tanggalFormat}</td>
                      <td className="p-5 text-slate-600 border-r border-slate-50">{r.masuk ? new Date(r.masuk.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                      <td className="p-5 text-slate-600 border-r border-slate-100">{r.pulang ? new Date(r.pulang.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                      
                      {/* STATUS MASUK */}
                      <td className="p-5 border-r border-slate-50">
                        <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${r.statusMasuk.includes('TERLAMBAT') ? 'bg-orange-100 text-orange-600' : r.statusMasuk === '-' ? 'text-slate-200' : 'bg-green-100 text-green-600'}`}>
                          {r.statusMasuk}
                        </span>
                      </td>

                      {/* STATUS PULANG */}
                      <td className="p-5 border-r border-slate-100">
                        <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${r.statusPulang === '-' ? 'text-slate-200' : 'bg-blue-100 text-blue-600'}`}>
                          {r.statusPulang}
                        </span>
                      </td>

                      {/* LOKASI DARI TABEL MEMANG */}
                      <td className="p-5 text-left min-w-[250px]">
                        <div className="flex flex-col gap-2">
                          {r.masuk && (
                            <div className="bg-slate-100/50 p-2 rounded-xl border-l-4 border-red-500">
                              <p className="text-[7px] text-slate-400 uppercase font-black mb-1">Lokasi Masuk:</p>
                              <p className="text-[9px] leading-tight text-slate-600 italic">"{r.lokasiMasuk}"</p>
                            </div>
                          )}
                          {r.pulang && (
                            <div className="bg-blue-50/50 p-2 rounded-xl border-l-4 border-blue-500">
                              <p className="text-[7px] text-blue-400 uppercase font-black mb-1">Lokasi Pulang:</p>
                              <p className="text-[9px] leading-tight text-blue-600 italic">"{r.lokasiPulang}"</p>
                            </div>
                          )}
                          {!r.masuk && !r.pulang && <span className="text-slate-300">-</span>}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="p-20 text-slate-300 font-black uppercase tracking-widest italic text-center">Data Belum Tersedia</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* TAB PENGAUAN IZIN */
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom duration-500">
             {/* FORM SEBELAH KIRI */}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Dari Tanggal</label>
                      <input type="date" required value={formIzin.tanggal_mulai} onChange={e => setFormIzin({...formIzin, tanggal_mulai: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold ring-1 ring-slate-100"/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Sampai Tanggal</label>
                      <input type="date" required value={formIzin.tanggal_selesai} onChange={e => setFormIzin({...formIzin, tanggal_selesai: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold ring-1 ring-slate-100"/>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Alasan / Keterangan</label>
                    <textarea required value={formIzin.keterangan} onChange={e => setFormIzin({...formIzin, keterangan: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold h-24 outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-red-600" placeholder="Tuliskan alasan lengkap..."/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Foto Bukti (Dokumen/Surat)</label>
                    <input type="file" onChange={e => setFormIzin({...formIzin, file: e.target.files?.[0]})} className="w-full p-3 bg-slate-50 rounded-2xl text-[10px] font-bold ring-1 ring-slate-100"/>
                  </div>
                  <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg hover:bg-red-700 transition active:scale-95">Kirim Ke Admin</button>
                </form>
             </div>

             {/* RIWAYAT SEBELAH KANAN */}
             <div className="bg-white/90 p-8 rounded-[32px] shadow-xl border border-slate-100 h-fit">
                <h2 className="text-[11px] font-black uppercase text-slate-800 mb-6 tracking-widest border-l-4 border-slate-800 pl-4">Status Pengajuan Anda</h2>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {myIzin.length > 0 ? myIzin.map((izin: any, idx: number) => (
                    <div key={idx} className="p-5 bg-slate-50 rounded-[24px] border border-slate-100 hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[8px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${izin.status === 'Disetujui' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                          {izin.status || 'DALAM PROSES'}
                        </span>
                        <p className="text-[8px] text-slate-400 font-bold">{new Date(izin.created_at).toLocaleDateString('id-ID')}</p>
                      </div>
                      <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{izin.jenis}</p>
                      <p className="text-[10px] text-slate-500 italic leading-relaxed">"{izin.keterangan}"</p>
                    </div>
                  )) : (
                    <div className="py-20 text-center text-slate-300 font-bold text-[9px] uppercase italic tracking-widest">Belum ada riwayat pengajuan</div>
                  )}
                </div>
             </div>
          </div>
        )}
      </div>
      <style jsx global>{`.bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }`}</style>
    </div>
  );
}

export default function GuruDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-black text-slate-300 uppercase">SINKRONISASI DATA...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
