"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // LOGIKA SMART ID: Mengambil ID meskipun URL salah tulis (?id=1 atau ?=1)
  const guruIdFromUrl = searchParams.get("id") || (typeof window !== 'undefined' ? window.location.search.split('=')[1] : null);

  const [activeTab, setActiveTab] = useState("home");
  const [profile, setProfile] = useState<any>(null);
  const [myRekap, setMyRekap] = useState<any[]>([]);
  const [todayStatus, setTodayStatus] = useState<any>({ masuk: null, pulang: null });
  const [loading, setLoading] = useState(true);

  const [formIzin, setFormIzin] = useState({ jenis: "Izin", keterangan: "", file: null as any });
  const API_URL = "https://backendabsen.mejatika.com/api";

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (!guruIdFromUrl) {
        // Jika tidak ada ID di URL, cek token login (untuk Admin)
        const token = localStorage.getItem("auth_token");
        if (!token) {
          router.push("/");
          return;
        }
      }

      // 1. Ambil Profil & Status Hari Ini (Route Publik)
      const resStatus = await fetch(`${API_URL}/cek-status-absen/${guruIdFromUrl}`);
      const statusJson = await resStatus.json();

      if (statusJson.success) {
        setProfile({
          nama_lengkap: statusJson.nama || "Guru",
          nip: "-"
        });

        // 2. Ambil Rekap Absensi (Route yang baru kita pindahkan ke publik)
        const resRekap = await fetch(`${API_URL}/admin/rekap-absensi`);
        const rekapJson = await resRekap.json();
        
        // Laravel biasanya membungkus data dalam properti .data
        const allData = Array.isArray(rekapJson) ? rekapJson : (rekapJson.data || []);
        
        // Filter data berdasarkan ID guru
        const rawData = allData.filter((item: any) => String(item.guru_id) === String(guruIdFromUrl));

        // --- LOGIKA GROUPING ---
        const grouped = rawData.reduce((acc: any, curr: any) => {
          const dateObj = new Date(curr.waktu_absen);
          const dateKey = dateObj.toLocaleDateString('en-CA'); 
          
          if (!acc[dateKey]) {
            acc[dateKey] = { 
              tanggalRaw: dateObj, 
              tanggalFormat: dateObj.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }), 
              masuk: null, 
              pulang: null 
            };
          }
          
          const statusLower = curr.status.toLowerCase();
          if (statusLower.includes('masuk') || statusLower.includes('terlambat')) {
            acc[dateKey].masuk = curr;
          } else if (statusLower.includes('pulang')) {
            acc[dateKey].pulang = curr;
          }
          return acc;
        }, {});

        const finalizedRekap = Object.values(grouped).sort((a: any, b: any) => 
          b.tanggalRaw.getTime() - a.tanggalRaw.getTime()
        );
        
        setMyRekap(finalizedRekap);

        // Update status hari ini di dashboard
        const todayKey = new Date().toLocaleDateString('en-CA');
        if (grouped[todayKey]) {
          setTodayStatus({ 
            masuk: grouped[todayKey].masuk, 
            pulang: grouped[todayKey].pulang 
          });
        }
      } else {
          // Jika ID tidak valid di database
          console.error("Guru tidak ditemukan");
      }
    } catch (err) {
      console.error("Koneksi API Gagal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (guruIdFromUrl) loadData(); 
  }, [guruIdFromUrl]);

  const handleIzinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formIzin.keterangan) return Swal.fire("Opps", "Alasan harus diisi", "warning");

    const formData = new FormData();
    formData.append("guru_id", guruIdFromUrl || "");
    formData.append("jenis", formIzin.jenis);
    formData.append("keterangan", formIzin.keterangan);
    if (formIzin.file) formData.append("foto_bukti", formIzin.file);

    Swal.fire({ title: "Mengirim...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
      const res = await fetch(`${API_URL}/pengajuan-izin`, { // Gunakan route publik /pengajuan-izin
        method: "POST", 
        body: formData 
      });
      if (res.ok) {
        Swal.fire("Berhasil", "Pengajuan izin berhasil dikirim!", "success");
        setFormIzin({ jenis: "Izin", keterangan: "", file: null });
        setActiveTab("home");
        loadData();
      } else {
        Swal.fire("Gagal", "Gagal mengirim pengajuan", "error");
      }
    } catch (err) { 
      Swal.fire("Error", "Terjadi kesalahan koneksi.", "error"); 
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#fdf5e6]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        <p className="mt-4 text-xs font-bold text-slate-400">SINKRONISASI DATA...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf5e6] p-4 md:p-8 bg-batik animate-in fade-in duration-700">
      <div className="max-w-4xl mx-auto">
         {/* --- HEADER --- */}
         <header className="mb-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-6 rounded-[30px] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-red-200">
              {profile?.nama_lengkap?.charAt(0) || "G"}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">{profile?.nama_lengkap}</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID GURU: {guruIdFromUrl}</p>
            </div>
          </div>
          <button onClick={() => router.push("/")} className="bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase hover:bg-black transition tracking-widest">
            🏠 Ke Scanner
          </button>
        </header>

        {/* --- STATUS HARI INI --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className={`p-6 rounded-[30px] border transition-all ${todayStatus.masuk ? 'bg-green-50 border-green-100' : 'bg-white border-slate-100'}`}>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Masuk</p>
            <h2 className={`text-3xl font-black mt-2 ${todayStatus.masuk ? 'text-green-600' : 'text-slate-200'}`}>
              {todayStatus.masuk ? new Date(todayStatus.masuk.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '--:--'}
            </h2>
          </div>
          <div className={`p-6 rounded-[30px] border transition-all ${todayStatus.pulang ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100'}`}>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Pulang</p>
            <h2 className={`text-3xl font-black mt-2 ${todayStatus.pulang ? 'text-blue-600' : 'text-slate-200'}`}>
              {todayStatus.pulang ? new Date(todayStatus.pulang.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '--:--'}
            </h2>
          </div>
        </div>

        {/* --- TABS --- */}
        <nav className="flex gap-2 mb-6 bg-white/50 backdrop-blur-sm p-2 rounded-2xl w-fit border border-white">
          <button onClick={() => setActiveTab("home")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase ${activeTab === 'home' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>🏠 Rekap</button>
          <button onClick={() => setActiveTab("izin")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase ${activeTab === 'izin' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400'}`}>✉️ Izin</button>
        </nav>

        {/* --- TAB CONTENT --- */}
        {activeTab === "home" ? (
          <div className="bg-white/90 backdrop-blur-md rounded-[32px] shadow-xl border border-slate-100 overflow-hidden">
             <table className="w-full">
                <thead className="bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="p-6 text-left">Tanggal</th>
                    <th className="p-6 text-center">Masuk</th>
                    <th className="p-6 text-center">Pulang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {myRekap.length > 0 ? myRekap.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      <td className="p-6 text-xs font-black text-slate-700">{r.tanggalFormat}</td>
                      <td className="p-6 text-center text-xs font-black text-slate-600">{r.masuk ? new Date(r.masuk.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                      <td className="p-6 text-center text-xs font-black text-blue-600">{r.pulang ? new Date(r.pulang.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="p-20 text-center text-slate-300 italic">Tidak ada data</td></tr>
                  )}
                </tbody>
              </table>
          </div>
        ) : (
          <div className="bg-white/90 p-8 rounded-[32px] shadow-xl border border-slate-100 max-w-2xl mx-auto">
             <form onSubmit={handleIzinSubmit} className="space-y-5">
                <select value={formIzin.jenis} onChange={e => setFormIzin({...formIzin, jenis: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold outline-none">
                  <option value="Izin">Izin</option>
                  <option value="Sakit">Sakit</option>
                </select>
                <textarea required value={formIzin.keterangan} onChange={e => setFormIzin({...formIzin, keterangan: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-bold h-32 outline-none" placeholder="Alasan..."/>
                <input type="file" onChange={e => setFormIzin({...formIzin, file: e.target.files?.[0]})} className="text-xs"/>
                <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">Kirim</button>
             </form>
          </div>
        )}
      </div>
      <style jsx global>{`.bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }`}</style>
    </div>
  );
}

export default function GuruDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
