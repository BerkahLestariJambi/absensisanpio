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
            acc[dateKey].statusMasuk = curr.status.toUpperCase();
            acc[dateKey].lokasiMasuk = lokasiTxt;
          } else if (st.includes('pulang')) {
            acc[dateKey].pulang = curr;
            acc[dateKey].statusPulang = "HADIR"; // Ataupun status spesifik dari API
            acc[dateKey].lokasiPulang = lokasiTxt;
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
      } else { Swal.fire("Gagal", "Cek data", "error"); }
    } catch (err) { Swal.fire("Error", "Server error.", "error"); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#fdf5e6] font-black text-slate-400 uppercase">Sinkronisasi...</div>;

  return (
    <div className="min-h-screen bg-[#fdf5e6] p-4 md:p-8 bg-batik animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-6 rounded-[30px] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg uppercase">{profile?.nama_lengkap?.charAt(0)}</div>
            <div>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">{profile?.nama_lengkap}</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">ID: {guruIdFromUrl}</p>
            </div>
          </div>
          <button onClick={() => router.push("/")} className="bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition">🏠 Scanner</button>
        </header>

        <nav className="flex gap-2 mb-6 bg-white/50 p-2 rounded-2xl w-fit border border-white">
          <button onClick={() => setActiveTab("home")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'home' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>🏠 Riwayat</button>
          <button onClick={() => setActiveTab("izin")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'izin' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400'}`}>✉️ Pengajuan</button>
        </nav>

        {activeTab === "home" ? (
          <div className="bg-white/90 backdrop-blur-md rounded-[32px] shadow-xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead className="bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest">
                  {/* BARIS HEADER 1 */}
                  <tr>
                    <th rowSpan={2} className="p-5 text-left border-r border-slate-700">Tanggal</th>
                    <th rowSpan={2} className="p-5 border-r border-slate-700">Masuk</th>
                    <th rowSpan={2} className="p-5 border-r border-slate-700">Pulang</th>
                    <th colSpan={2} className="p-3 border-b border-slate-700 border-r border-slate-700">Status</th>
                    <th rowSpan={2} className="p-5 text-left">Keterangan Lokasi</th>
                  </tr>
                  {/* BARIS HEADER 2 (Sub-header Status) */}
                  <tr>
                    <th className="p-3 border-r border-slate-700">Masuk</th>
                    <th className="p-3 border-r border-slate-700">Pulang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-[11px] font-bold">
                  {myRekap.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      <td className="p-5 text-left font-black text-slate-700 border-r border-slate-100">{r.tanggalFormat}</td>
                      <td className="p-5 text-slate-600 border-r border-slate-50">{r.masuk ? new Date(r.masuk.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                      <td className="p-5 text-slate-600 border-r border-slate-100">{r.pulang ? new Date(r.pulang.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                      
                      {/* SUB-KOLOM STATUS MASUK */}
                      <td className="p-5 border-r border-slate-50">
                        <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${r.statusMasuk.includes('TERLAMBAT') ? 'bg-orange-100 text-orange-600' : r.statusMasuk === '-' ? 'text-slate-200' : 'bg-green-100 text-green-600'}`}>
                          {r.statusMasuk}
                        </span>
                      </td>

                      {/* SUB-KOLOM STATUS PULANG */}
                      <td className="p-5 border-r border-slate-100">
                        <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${r.statusPulang === 'PULANG' || r.statusPulang === 'HADIR' ? 'bg-blue-100 text-blue-600' : 'text-slate-200'}`}>
                          {r.statusPulang}
                        </span>
                      </td>

                      <td className="p-5 text-left max-w-[200px]">
                        <div className="flex flex-col gap-1 overflow-hidden">
                          {r.masuk && <p className="text-[8px] leading-tight text-slate-500 bg-slate-100/50 p-2 rounded-lg truncate" title={r.lokasiMasuk}><strong>IN:</strong> {r.lokasiMasuk}</p>}
                          {r.pulang && <p className="text-[8px] leading-tight text-blue-500 bg-blue-50 p-2 rounded-lg truncate" title={r.lokasiPulang}><strong>OUT:</strong> {r.lokasiPulang}</p>}
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
          /* BAGIAN FORM (Tetap) */
          <div className="max-w-2xl mx-auto">
             {/* ... Form Pengajuan tetap sama seperti kode Anda sebelumnya ... */}
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
