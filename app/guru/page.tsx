"use client";
import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const guruIdFromUrl = useMemo(() => {
    return searchParams.get("id") || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null);
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState("home");
  const [profile, setProfile] = useState<any>(null);
  const [myRekap, setMyRekap] = useState<any[]>([]);
  const [myIzin, setMyIzin] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
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

      const resStatus = await fetch(`${API_URL}/cek-status-absen/${guruIdFromUrl}`);
      const statusJson = await resStatus.json();

      if (statusJson.success) {
        setProfile({ nama_lengkap: statusJson.nama || "Guru" });

        const resRekap = await fetch(`${API_URL}/admin/rekap-absensi`);
        const rekapJson = await resRekap.json();
        const allData = Array.isArray(rekapJson) ? rekapJson : (rekapJson.data || []);
        
        const rawData = allData.filter((item: any) => String(item.guru_id) === String(guruIdFromUrl));

        // --- PERBAIKAN LOGIKA GROUPING ---
        // Menggunakan string split agar jam TIDAK BERUBAH karena timezone
        const grouped = rawData.reduce((acc: any, curr: any) => {
          if (!curr.waktu_absen) return acc;

          // Contoh data: "2026-04-24 08:14:00"
          const parts = curr.waktu_absen.split(' '); 
          const dateKey = parts[0]; // "2026-04-24"
          const timeOnly = parts[1] ? parts[1].substring(0, 5) : "--:--"; // "08:14"

          if (!acc[dateKey]) {
            // Buat format tanggal manual untuk tampilan ID
            const dObj = new Date(dateKey);
            acc[dateKey] = { 
              tanggalFormat: dObj.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' }), 
              masuk: null, 
              pulang: null,
              statusMasuk: "-", 
              statusPulang: "-",
              lokasiMasuk: "-", 
              lokasiPulang: "-",
              rawDate: dObj,
              jamMasukTeks: "--:--", // Simpan jam sebagai teks murni
              jamPulangTeks: "--:--"
            };
          }
          
          const st = curr.status.toLowerCase();
          const lokasiTxt = curr.keterangan_lokasi || "Lokasi tidak tercatat";

          if (st.includes('pulang')) {
            acc[dateKey].pulang = curr;
            acc[dateKey].jamPulangTeks = timeOnly; // Ambil teks jam dari database
            acc[dateKey].statusPulang = curr.status.toUpperCase();
            acc[dateKey].lokasiPulang = lokasiTxt;
          } else {
            acc[dateKey].masuk = curr;
            acc[dateKey].jamMasukTeks = timeOnly; // Ambil teks jam dari database
            acc[dateKey].statusMasuk = curr.status.toUpperCase();
            acc[dateKey].lokasiMasuk = lokasiTxt;
          }
          return acc;
        }, {});

        setMyRekap(Object.values(grouped).sort((a: any, b: any) => b.rawDate.getTime() - a.rawDate.getTime()));

        const resIzin = await fetch(`${API_URL}/admin/daftar-izin`);
        const izinJson = await resIzin.json();
        const allIzin = Array.isArray(izinJson) ? izinJson : (izinJson.data || []);
        setMyIzin(allIzin.filter((i: any) => String(i.guru_id) === String(guruIdFromUrl)).reverse());
      }
    } catch (err) {
      console.error("Error Load Data:", err);
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

  // ... (handleIzinSubmit tetap sama)

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black animate-pulse">SINKRONISASI...</div>;

  return (
    <div className="min-h-screen bg-[#fdf5e6] p-4 md:p-8 bg-batik">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/90 p-6 rounded-[30px] shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black">
              {profile?.nama_lengkap?.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 uppercase">{profile?.nama_lengkap}</h1>
              <p className="text-[10px] text-slate-400 font-mono italic">ID: {guruIdFromUrl}</p>
            </div>
          </div>
          <button onClick={() => router.push("/")} className="bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase">🏠 Mesin Absen</button>
        </header>

        <nav className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab("home")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase ${activeTab === 'home' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400'}`}>Riwayat Absen</button>
          <button onClick={() => setActiveTab("izin")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase ${activeTab === 'izin' ? 'bg-red-600 text-white' : 'bg-white text-slate-400'}`}>Pengajuan Izin</button>
        </nav>

        {activeTab === "home" ? (
          <div className="space-y-4">
            {/* Filter */}
            <div className="bg-white/90 p-4 rounded-[24px] flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-2 items-center">
                <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="p-2 bg-slate-50 rounded-xl text-[10px] font-bold">
                  {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', {month: 'long'})}</option>)}
                </select>
                <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="p-2 bg-slate-50 rounded-xl text-[10px] font-bold">
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-white/90 rounded-[32px] shadow-xl overflow-hidden border border-slate-100">
              <table className="w-full text-center border-collapse">
                <thead className="bg-slate-800 text-white text-[9px] font-black uppercase">
                  <tr>
                    <th rowSpan={2} className="p-4 text-left border-r border-slate-700">Tanggal</th>
                    <th rowSpan={2} className="p-4 border-r border-slate-700">Jam Masuk</th>
                    <th rowSpan={2} className="p-4 border-r border-slate-700">Jam Pulang</th>
                    <th colSpan={2} className="p-2 border-b border-slate-700 bg-slate-700">Status</th>
                    <th rowSpan={2} className="p-4 text-left">Lokasi / Keterangan</th>
                  </tr>
                  <tr className="bg-slate-700/50">
                    <th className="p-2 border-r border-slate-600">Masuk</th>
                    <th className="p-2">Pulang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px] font-bold">
                  {filteredRekap.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      <td className="p-4 text-left border-r">
                        <span className="block text-slate-800">{r.tanggalFormat}</span>
                        <span className="text-[8px] text-slate-400">{new Date(r.rawDate).toLocaleDateString('id-ID', {weekday: 'long'})}</span>
                      </td>

                      {/* JAM MASUK - Menggunakan teks murni */}
                      <td className="p-4 border-r">
                        {r.masuk ? (
                          <span className="bg-slate-100 px-2 py-1 rounded text-slate-800 font-mono">
                            {r.jamMasukTeks} 
                          </span>
                        ) : "-"}
                      </td>

                      {/* JAM PULANG - Menggunakan teks murni */}
                      <td className="p-4 border-r">
                        {r.pulang ? (
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-mono border border-blue-100">
                            {r.jamPulangTeks}
                          </span>
                        ) : <span className="text-slate-300 italic">Belum Pulang</span>}
                      </td>

                      <td className="p-4 border-r">
                        <span className={`px-2 py-1 rounded-full text-[8px] uppercase ${
                          r.statusMasuk.includes('TERLAMBAT') ? 'bg-orange-100 text-orange-600' : 
                          r.statusMasuk === '-' ? 'text-slate-300' : 'bg-green-100 text-green-600'
                        }`}>
                          {r.statusMasuk}
                        </span>
                      </td>
                      <td className="p-4 border-r">
                        <span className={`px-2 py-1 rounded-full text-[8px] uppercase ${
                          r.statusPulang === '-' ? 'text-slate-300' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {r.statusPulang}
                        </span>
                      </td>
                      <td className="p-4 text-left min-w-[250px]">
                        <div className="space-y-1">
                          {r.masuk && (
                            <div className="text-[9px] bg-slate-50 p-2 rounded-lg border-l-2 border-red-500">
                              <span className="text-slate-400 block text-[7px]">MASUK/KET:</span>
                              "{r.lokasiMasuk}"
                            </div>
                          )}
                          {r.pulang && (
                            <div className="text-[9px] bg-blue-50 p-2 rounded-lg border-l-2 border-blue-500">
                              <span className="text-blue-400 block text-[7px]">PULANG:</span>
                              "{r.lokasiPulang}"
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
          /* Form Izin... (bagian form tetap sama) */
          <div>...</div>
        )}
      </div>
      <style jsx global>{`.bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }`}</style>
    </div>
  );
}

export default function GuruDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-black">SINKRONISASI...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
