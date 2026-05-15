"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";

// Ikon sederhana untuk memperjelas fitur
const Icon = ({ name }: { name: string }) => {
  switch (name) {
    case "izin": return <span className="mr-2">📝</span>;
    case "sakit": return <span className="mr-2">🤒</span>;
    case "cuti": return <span className="mr-2">📅</span>;
    case "dinas": return <span className="mr-2">✈️</span>;
    case "upload": return <span className="mr-2">📁</span>;
    default: return null;
  }
};

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
              tanggalFormat: new Date(curr.waktu_absen).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
              masuk: null, pulang: null,
              statusMasuk: "-", statusPulang: "-",
              lokasiMasuk: "-", lokasiPulang: "-",
              rawDate: new Date(curr.waktu_absen),
              isSpecialStatus: false
            };
          }
          const st = curr.status ? curr.status.toLowerCase() : "";
          const lokasiTxt = curr.keterangan_lokasi || "Lokasi tidak tercatat";
          const isSpecial = ['sakit', 'izin', 'cuti', 'dinas'].some(key => st.includes(key));

          if (isSpecial) {
            acc[dateKey].statusMasuk = curr.status.toUpperCase();
            acc[dateKey].lokasiMasuk = lokasiTxt;
            acc[dateKey].isSpecialStatus = true;
          } else if (st.includes('masuk') || st.includes('terlambat')) {
            acc[dateKey].masuk = curr;
            acc[dateKey].statusMasuk = curr.status.toUpperCase();
            acc[dateKey].lokasiMasuk = lokasiTxt;
          } else if (st.includes('pulang')) {
            acc[dateKey].pulang = curr;
            acc[dateKey].statusPulang = curr.status.toUpperCase();
            acc[dateKey].lokasiPulang = lokasiTxt;
          }
          return acc;
        }, {});

        setMyRekap(Object.values(grouped).sort((a: any, b: any) => b.rawDate - a.rawDate));

        const resIzin = await fetch(`${API_URL}/admin/daftar-izin`);
        const izinJson = await resIzin.json();
        const allIzin = Array.isArray(izinJson) ? izinJson : (izinJson.data || []);
        
        const filteredIzin = allIzin.filter((i: any) => String(i.guru_id) === String(guruIdFromUrl));
        setMyIzin(filteredIzin.reverse());
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

    if (formIzin.jenis !== "Sakit") {
      if (formIzin.tanggal_mulai) formData.append("tanggal_mulai", formIzin.tanggal_mulai);
      if (formIzin.tanggal_selesai) formData.append("tanggal_selesai", formIzin.tanggal_selesai);
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

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#fdf5e6] font-black text-slate-400 uppercase tracking-widest">Sinkronisasi Database...</div>;

  return (
    <div className="min-h-screen bg-[#fdf5e6] p-4 md:p-8 bg-batik">
      <div className="max-w-7xl mx-auto">
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
                    <th rowSpan={2} className="p-5 text-left">Keterangan Lokasi</th>
                  </tr>
                  <tr className="bg-slate-700/50">
                    <th className="p-3 border-r border-slate-600">Masuk</th>
                    <th className="p-3 border-r border-slate-600">Pulang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-[11px] font-bold">
                  {myRekap.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition">
                      <td className="p-5 text-left font-black text-slate-700 border-r border-slate-100">{r.tanggalFormat}</td>
                      <td className="p-5 text-slate-600 border-r border-slate-50">{(r.masuk && !r.isSpecialStatus) ? new Date(r.masuk.waktu_absen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '-'}</td>
                      <td className="p-5 text-slate-600 border-r border-slate-100">{(r.pulang && !r.isSpecialStatus) ? new Date(r.pulang.waktu_absen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '-'}</td>
                      <td className="p-5 border-r border-slate-50">
                        <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${r.statusMasuk.includes('TERLAMBAT') ? 'bg-orange-100 text-orange-600' : r.statusMasuk === '-' ? 'text-slate-200' : 'bg-green-100 text-green-600'}`}>
                          {r.statusMasuk}
                        </span>
                      </td>
                      <td className="p-5 border-r border-slate-100">
                        <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${r.statusPulang === '-' ? 'text-slate-200' : 'bg-blue-100 text-blue-600'}`}>
                          {r.statusPulang}
                        </span>
                      </td>
                      <td className="p-5 text-left min-w-[250px]">
                        <div className="flex flex-col gap-2">
                          {(r.masuk || r.isSpecialStatus) && (
                            <div className={`p-2 rounded-xl border-l-4 ${r.isSpecialStatus ? 'bg-purple-50 border-purple-500' : 'bg-slate-100/50 border-red-500'}`}>
                              <p className="text-[7px] text-slate-400 uppercase font-black mb-1">{r.isSpecialStatus ? 'Keterangan:' : 'Lokasi Masuk:'}</p>
                              <p className="text-[9px] leading-tight text-slate-600 italic">"{r.lokasiMasuk}"</p>
                            </div>
                          )}
                          {r.pulang && !r.isSpecialStatus && (
                            <div className="bg-blue-50/50 p-2 rounded-xl border-l-4 border-blue-500">
                              <p className="text-[7px] text-blue-400 uppercase font-black mb-1">Lokasi Pulang:</p>
                              <p className="text-[9px] leading-tight text-blue-600 italic">"{r.lokasiPulang}"</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white p-8 rounded-[32px] shadow-2xl border-t-8 border-red-600 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">✉️</div>
                <h2 className="text-sm font-black uppercase text-slate-800 mb-6 tracking-widest flex items-center">
                  <span className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center mr-3 text-xs">1</span>
                  Isi Formulir Pengajuan
                </h2>

                <form onSubmit={handleIzinSubmit} className="space-y-5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 flex items-center">
                      <Icon name={formIzin.jenis.toLowerCase().split(' ')[0]} /> Jenis Absensi
                    </label>
                    <select 
                      value={formIzin.jenis} 
                      onChange={e => setFormIzin({...formIzin, jenis: e.target.value})} 
                      className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold border-2 border-slate-100 focus:border-red-600 focus:bg-white outline-none transition-all appearance-none"
                    >
                      <option value="Izin">Izin (Keperluan Pribadi)</option>
                      <option value="Sakit">Sakit (Butuh Istirahat)</option>
                      <option value="Cuti">Cuti Tahunan</option>
                      <option value="Dinas Luar">Dinas Luar / Tugas</option>
                    </select>
                  </div>

                  {formIzin.jenis !== "Sakit" && (
                    <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100 grid grid-cols-1 gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-red-400">📅 Dari Tanggal</label>
                          <input type="date" required value={formIzin.tanggal_mulai} onChange={e => setFormIzin({...formIzin, tanggal_mulai: e.target.value})} className="w-full p-3 bg-white rounded-xl text-xs font-bold border border-red-100 outline-none focus:ring-2 focus:ring-red-600"/>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-red-400">📅 Sampai Tanggal</label>
                          <input type="date" required value={formIzin.tanggal_selesai} onChange={e => setFormIzin({...formIzin, tanggal_selesai: e.target.value})} className="w-full p-3 bg-white rounded-xl text-xs font-bold border border-red-100 outline-none focus:ring-2 focus:ring-red-600"/>
                        </div>
                      </div>
                      <p className="text-[8px] text-red-400 font-bold italic">* Lewati jika hanya 1 hari (samakan tanggal)</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">✍️ Alasan Lengkap</label>
                    <textarea 
                      required 
                      value={formIzin.keterangan} 
                      onChange={e => setFormIzin({...formIzin, keterangan: e.target.value})} 
                      className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold h-28 border-2 border-slate-100 focus:border-red-600 focus:bg-white outline-none transition-all" 
                      placeholder={formIzin.jenis === "Sakit" ? "Sebutkan gejala atau keterangan sakit..." : "Contoh: Menghadiri acara keluarga di luar kota..."}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500 flex items-center">
                      <Icon name="upload" /> Unggah Bukti <span className="text-[8px] ml-2 text-slate-400">(JPG/PNG/PDF)</span>
                    </label>
                    <div className="relative group">
                      <input 
                        type="file" 
                        onChange={e => setFormIzin({...formIzin, file: e.target.files?.[0]})} 
                        className="w-full p-3 bg-slate-50 rounded-2xl text-[10px] font-bold border-2 border-dashed border-slate-200 group-hover:border-red-400 transition cursor-pointer"
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-red-700 hover:shadow-red-200 transition-all active:scale-95 flex items-center justify-center">
                    KIRIM PENGAJUAN SEKARANG 🚀
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-800 p-8 rounded-[32px] shadow-xl text-white">
                <h2 className="text-sm font-black uppercase mb-6 tracking-widest flex items-center">
                   <span className="w-8 h-8 bg-slate-700 text-white rounded-full flex items-center justify-center mr-3 text-xs">2</span>
                   Status Pengajuan Terakhir
                </h2>
                
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {myIzin.map((izin: any, idx: number) => (
                    <div key={idx} className="group bg-slate-700/50 p-5 rounded-[24px] border border-slate-600 hover:bg-slate-700 transition-all">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                           <div className={`w-2 h-2 rounded-full animate-pulse ${izin.status === 'Disetujui' ? 'bg-green-400' : izin.status === 'Ditolak' ? 'bg-red-400' : 'bg-orange-400'}`}></div>
                           <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${izin.status === 'Disetujui' ? 'bg-green-500/20 text-green-400' : izin.status === 'Ditolak' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                             {izin.status || 'MENUNGGU KONFIRMASI'}
                           </span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono font-bold uppercase">{new Date(izin.created_at).toLocaleDateString('id-ID', {day: '2-digit', month: 'long'})}</p>
                      </div>

                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-black uppercase text-white mb-1">{izin.jenis}</p>
                          <p className="text-[11px] text-slate-300 italic leading-relaxed bg-slate-800/50 p-3 rounded-xl border-l-2 border-slate-500">
                            "{izin.keterangan}"
                          </p>
                        </div>
                        {izin.foto_bukti && (
                           <a href={`https://backendabsen.mejatika.com/storage/${izin.foto_bukti}`} target="_blank" className="text-[8px] bg-white/10 p-2 rounded-lg hover:bg-white/20 transition uppercase font-black">Lihat Bukti 📎</a>
                        )}
                      </div>
                      
                      {izin.tanggal_mulai && (
                        <div className="mt-3 flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                           <span>{new Date(izin.tanggal_mulai).toLocaleDateString('id-ID')}</span>
                           <span className="w-4 h-[1px] bg-slate-500"></span>
                           <span>{new Date(izin.tanggal_selesai).toLocaleDateString('id-ID')}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {myIzin.length === 0 && (
                    <div className="py-24 text-center">
                      <div className="text-5xl mb-4 opacity-20">📭</div>
                      <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em]">Belum ada riwayat pengajuan izin</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }
      `}</style>
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
