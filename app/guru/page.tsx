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

      const resStatus = await fetch(`${API_URL}/cek-status-absen/${guruIdFromUrl}`);
      const statusJson = await resStatus.json();

      if (statusJson.success) {
        setProfile({ nama_lengkap: statusJson.nama || "Guru" });

        const resRekap = await fetch(`${API_URL}/admin/rekap-absensi`);
        const rekapJson = await resRekap.json();
        const allData = Array.isArray(rekapJson) ? rekapJson : (rekapJson.data || []);
        const rawData = allData.filter((item: any) => String(item.guru_id) === String(guruIdFromUrl));

        const grouped = rawData.reduce((acc: any, curr: any) => {
          const dateKey = new Date(curr.waktu_absen).toLocaleDateString('en-CA'); 
          if (!acc[dateKey]) {
            acc[dateKey] = { 
              tanggalFormat: new Date(curr.waktu_absen).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }), 
              masuk: null, 
              pulang: null,
              statusMasuk: "-",
              statusPulang: "-",
              lokasiMasuk: "-",
              lokasiPulang: "-",
              rawDate: new Date(curr.waktu_absen)
            };
          }
          
          const st = curr.status.toLowerCase();
          const lokasi = curr.latitude && curr.longitude ? `${curr.latitude}, ${curr.longitude}` : "Lokasi tidak ada";

          if (st.includes('masuk') || st.includes('terlambat')) {
            acc[dateKey].masuk = curr;
            acc[dateKey].statusMasuk = curr.status.toUpperCase();
            acc[dateKey].lokasiMasuk = lokasi;
          } else if (st.includes('pulang')) {
            acc[dateKey].pulang = curr;
            acc[dateKey].statusPulang = "PULANG";
            acc[dateKey].lokasiPulang = lokasi;
          }
          return acc;
        }, {});
        setMyRekap(Object.values(grouped).sort((a: any, b: any) => b.rawDate - a.rawDate));

        const resIzin = await fetch(`${API_URL}/admin/daftar-izin`);
        const izinJson = await resIzin.json();
        const allIzin = Array.isArray(izinJson) ? izinJson : (izinJson.data || []);
        setMyIzin(allIzin.filter((i: any) => String(i.guru_id) === String(guruIdFromUrl)).reverse());
      }
    } catch (err) {
      console.error("Gagal sinkronisasi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (guruIdFromUrl) loadData(); }, [guruIdFromUrl]);

  const handleIzinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formIzin.jenis !== "Sakit" && (!formIzin.tanggal_mulai || !formIzin.tanggal_selesai)) {
      return Swal.fire("Opps", "Tanggal mulai dan selesai harus diisi", "warning");
    }

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
        Swal.fire("Berhasil", "Pengajuan berhasil dikirim!", "success");
        setFormIzin({ jenis: "Izin", keterangan: "", tanggal_mulai: "", tanggal_selesai: "", file: null });
        loadData();
      } else { Swal.fire("Gagal", "Terjadi kesalahan", "error"); }
    } catch (err) { Swal.fire("Error", "Koneksi terputus.", "error"); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#fdf5e6] font-black text-slate-400 uppercase tracking-tighter">Memuat Data...</div>;

  return (
    <div className="min-h-screen bg-[#fdf5e6] p-4 md:p-8 bg-batik animate-in fade-in duration-700">
      <div className="max-w-6xl mx-auto"> {/* Lebarkan container untuk tabel baru */}
        <header className="mb-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-6 rounded-[30px] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg uppercase">{profile?.nama_lengkap?.charAt(0)}</div>
            <div>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">{profile?.nama_lengkap}</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Dashboard Kehadiran</p>
            </div>
          </div>
          <button onClick={() => router.push("/")} className="bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition hover:scale-105">🏠 Mesin Absen</button>
        </header>

        <nav className="flex gap-2 mb-6 bg-white/50 p-2 rounded-2xl w-fit border border-white">
          <button onClick={() => setActiveTab("home")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'home' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>🏠 Riwayat Lengkap</button>
          <button onClick={() => setActiveTab("izin")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'izin' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400'}`}>✉️ Ajukan Izin</button>
        </nav>

        {activeTab === "home" ? (
          <div className="bg-white/90 backdrop-blur-md rounded-[32px] shadow-xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead className="bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="p-5 text-left border-r border-slate-700">Tanggal</th>
                    <th className="p-5">Jam Masuk</th>
                    <th className="p-5 border-r border-slate-700">Status Masuk</th>
                    <th className="p-5">Jam Pulang</th>
                    <th className="p-5 border-r border-slate-700">Status Pulang</th>
                    <th className="p-5">Lokasi (Lat, Long)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {myRekap.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      <td className="p-5 text-left text-xs font-black text-slate-700 border-r border-slate-100">{r.tanggalFormat}</td>
                      <td className="p-5 text-xs font-black text-slate-600">
                        {r.masuk ? new Date(r.masuk.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}
                      </td>
                      <td className="p-5 border-r border-slate-100">
                        <span className={`text-[8px] font-black px-3 py-1 rounded-lg uppercase ${r.statusMasuk.includes('TERLAMBAT') ? 'bg-orange-100 text-orange-600' : r.statusMasuk === '-' ? 'text-slate-300' : 'bg-green-100 text-green-600'}`}>
                          {r.statusMasuk}
                        </span>
                      </td>
                      <td className="p-5 text-xs font-black text-slate-600">
                        {r.pulang ? new Date(r.pulang.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}
                      </td>
                      <td className="p-5 border-r border-slate-100">
                        <span className={`text-[8px] font-black px-3 py-1 rounded-lg uppercase ${r.statusPulang === 'PULANG' ? 'bg-blue-100 text-blue-600' : 'text-slate-300'}`}>
                          {r.statusPulang}
                        </span>
                      </td>
                      <td className="p-5 text-[9px] font-bold text-slate-400">
                        <div className="flex flex-col gap-1">
                          {r.masuk && <span className="text-[8px] text-slate-500 bg-slate-100 px-2 py-1 rounded">In: {r.lokasiMasuk}</span>}
                          {r.pulang && <span className="text-[8px] text-blue-500 bg-blue-50 px-2 py-1 rounded">Out: {r.lokasiPulang}</span>}
                          {!r.masuk && !r.pulang && "-"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* BAGIAN FORM IZIN TETAP SAMA SEPERTI SEBELUMNYA */
          <div className="space-y-6">
            <div className="bg-white/90 p-8 rounded-[32px] shadow-xl border border-slate-100">
              <h2 className="text-[11px] font-black uppercase text-slate-800 mb-6 tracking-widest underline decoration-red-600 decoration-4 underline-offset-8">Form Pengajuan</h2>
              <form onSubmit={handleIzinSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Jenis Pengajuan</label>
                    <select value={formIzin.jenis} onChange={e => setFormIzin({...formIzin, jenis: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold outline-none border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-red-600">
                      <option value="Izin">Izin</option>
                      <option value="Sakit">Sakit</option>
                      <option value="Cuti">Cuti</option>
                      <option value="Dinas Luar">Dinas Luar</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Bukti Foto {formIzin.jenis === 'Sakit' ? '(Opsional)' : ''}</label>
                    <input type="file" onChange={e => setFormIzin({...formIzin, file: e.target.files?.[0]})} className="w-full p-3 bg-slate-50 rounded-2xl text-[10px] font-bold ring-1 ring-slate-100"/>
                  </div>
                </div>

                {formIzin.jenis !== "Sakit" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top duration-300">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Tanggal Mulai</label>
                      <input type="date" required value={formIzin.tanggal_mulai} onChange={e => setFormIzin({...formIzin, tanggal_mulai: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold ring-1 ring-slate-100"/>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Tanggal Selesai</label>
                      <input type="date" required value={formIzin.tanggal_selesai} onChange={e => setFormIzin({...formIzin, tanggal_selesai: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold ring-1 ring-slate-100"/>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Keterangan / Alasan</label>
                  <textarea required value={formIzin.keterangan} onChange={e => setFormIzin({...formIzin, keterangan: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold h-24 outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-red-600" placeholder="Jelaskan alasan pengajuan Anda..."/>
                </div>

                <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg shadow-red-100 hover:bg-red-700 active:scale-95">Kirim Pengajuan</button>
              </form>
            </div>

            <div className="bg-white/90 p-8 rounded-[32px] shadow-xl border border-slate-100">
              <h2 className="text-[11px] font-black uppercase text-slate-800 mb-6 tracking-widest underline decoration-slate-200 decoration-4 underline-offset-8">Riwayat Status</h2>
              <div className="space-y-3">
                {myIzin.length > 0 ? myIzin.map((izin: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-5 bg-slate-50 rounded-[24px] border border-slate-100">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${izin.status === 'Disetujui' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{izin.jenis}</p>
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(izin.created_at).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}</p>
                    </div>
                    <span className={`text-[8px] font-black px-4 py-2 rounded-xl uppercase tracking-widest ${izin.status === 'Disetujui' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>{izin.status || 'Pending'}</span>
                  </div>
                )) : <div className="py-10 text-center text-slate-300 font-bold text-[9px] uppercase italic tracking-widest">Belum ada pengajuan.</div>}
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
