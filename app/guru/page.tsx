"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";

export default function GuruDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Ambil ID dari URL hasil scan wajah
  const guruIdFromUrl = searchParams.get("id");

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
      
      // LOGIKA AKSES: Cek ID dari URL dulu (Publik), kalau tidak ada baru cek Token (Login)
      let fetchUrl = "";
      let headers: any = { "Accept": "application/json" };

      if (guruIdFromUrl) {
        // Mode Publik: Akses via ID hasil scan wajah
        fetchUrl = `${API_URL}/cek-status-absen/${guruIdFromUrl}`;
      } else {
        // Mode Private: Akses via Login (untuk Admin/Kepsek yang mau lihat data)
        const token = localStorage.getItem("auth_token");
        if (!token) {
          router.push("/"); // Jika tidak ada ID dan tidak ada Token, balik ke Home/Scanner
          return;
        }
        headers["Authorization"] = `Bearer ${token}`;
        fetchUrl = `${API_URL}/guru/rekap-pribadi`;
      }

      // 1. Ambil Data Profil & Status Hari Ini
      const resStatus = await fetch(fetchUrl, { headers });
      const statusJson = await resStatus.json();

      if (statusJson.success) {
        // Set profil sederhana dari data yang tersedia
        setProfile({
          nama_lengkap: statusJson.nama || statusJson.user?.nama_lengkap,
          nip: statusJson.user?.nip || "-"
        });

        // 2. Ambil Rekap Keseluruhan (Gunakan endpoint rekap publik)
        // Kita filter data berdasarkan guruId
        const resRekap = await fetch(`${API_URL}/admin/rekap-absensi`);
        const allData = await resRekap.json();
        
        const myId = guruIdFromUrl || statusJson.user?.id;
        const rawData = allData.filter((item: any) => item.guru_id == myId);

        // --- LOGIKA GROUPING 1 BARIS PER HARI (Tetap sama seperti kode anda) ---
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

        // Cek status hari ini
        const todayKey = new Date().toLocaleDateString('en-CA');
        if (grouped[todayKey]) {
          setTodayStatus({ 
            masuk: grouped[todayKey].masuk, 
            pulang: grouped[todayKey].pulang 
          });
        }
      }
    } catch (err) {
      console.error("Gagal sinkronisasi data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [guruIdFromUrl]);

  // Handle submit tetap butuh pengamanan (bisa pakai ID di URL jika API mendukung)
  const handleIzinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formIzin.keterangan) return Swal.fire("Opps", "Alasan harus diisi", "warning");

    const formData = new FormData();
    formData.append("guru_id", guruIdFromUrl || profile?.id); // Kirim ID Guru
    formData.append("jenis", formIzin.jenis);
    formData.append("keterangan", formIzin.keterangan);
    if (formIzin.file) formData.append("foto_bukti", formIzin.file);

    Swal.fire({ title: "Mengirim...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
      const res = await fetch(`${API_URL}/guru/ajukan-izin`, {
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

  if (loading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#fdf5e6] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sinkronisasi Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf5e6] p-4 md:p-8 bg-batik animate-in fade-in duration-700">
      <div className="max-w-4xl mx-auto">
        {/* HEADER GURU */}
        <header className="mb-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-6 rounded-[30px] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-red-200">
              {profile?.nama_lengkap?.charAt(0) || "G"}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">{profile?.nama_lengkap}</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">STATUS: GURU AKTIF</p>
            </div>
          </div>
          <button 
            onClick={() => router.push("/")}
            className="w-full md:w-auto bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase hover:bg-black transition tracking-widest"
          >
            🏠 Kembali ke Scanner
          </button>
        </header>

        {/* QUICK STATUS (KARTU ABSEN) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className={`p-6 rounded-[30px] border transition-all ${todayStatus.masuk ? 'bg-green-50 border-green-100' : 'bg-white border-slate-100'}`}>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Presensi Masuk</p>
            <h2 className={`text-3xl font-black mt-2 ${todayStatus.masuk ? 'text-green-600' : 'text-slate-200'}`}>
              {todayStatus.masuk ? new Date(todayStatus.masuk.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '--:--'}
            </h2>
            <p className="text-[10px] text-slate-400 mt-1 font-bold italic">{todayStatus.masuk?.status || 'Belum Terdeteksi'}</p>
          </div>
          <div className={`p-6 rounded-[30px] border transition-all ${todayStatus.pulang ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100'}`}>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Presensi Pulang</p>
            <h2 className={`text-3xl font-black mt-2 ${todayStatus.pulang ? 'text-blue-600' : 'text-slate-200'}`}>
              {todayStatus.pulang ? new Date(todayStatus.pulang.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '--:--'}
            </h2>
            <p className="text-[10px] text-slate-400 mt-1 font-bold italic">{todayStatus.pulang?.status || 'Belum Terdeteksi'}</p>
          </div>
        </div>

        {/* NAV GURU */}
        <nav className="flex gap-2 mb-6 bg-white/50 backdrop-blur-sm p-2 rounded-2xl w-fit border border-white shadow-sm">
          <button onClick={() => setActiveTab("home")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'home' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-white'}`}>🏠 Rekap Saya</button>
          <button onClick={() => setActiveTab("izin")} className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'izin' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-slate-400 hover:bg-white'}`}>✉️ Ajukan Izin</button>
        </nav>

        {/* ISI TAB RIWAYAT */}
        {activeTab === "home" && (
          <div className="bg-white/90 backdrop-blur-md rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="p-6 text-left">Tanggal</th>
                    <th className="p-6 text-center">Masuk</th>
                    <th className="p-6 text-center">Pulang</th>
                    <th className="p-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {myRekap.length > 0 ? myRekap.map((r: any, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="p-6 text-xs font-black text-slate-700 uppercase tracking-tighter">{r.tanggalFormat}</td>
                      <td className="p-6 text-center text-xs font-black text-slate-600">
                        {r.masuk ? new Date(r.masuk.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}
                      </td>
                      <td className="p-6 text-center text-xs font-black text-blue-600">
                        {r.pulang ? new Date(r.pulang.waktu_absen).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}
                      </td>
                      <td className="p-6 text-center">
                        <span className="text-[8px] font-black px-3 py-1 bg-slate-100 text-slate-500 rounded-lg uppercase">
                          {r.masuk?.status || r.pulang?.status || 'HADIR'}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="p-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest italic">Belum ada riwayat absensi</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB FORM IZIN */}
        {activeTab === "izin" && (
          <div className="bg-white/90 backdrop-blur-md p-8 rounded-[32px] shadow-xl border border-slate-100 max-w-2xl mx-auto">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Lengkapi Data Pengajuan</h2>
            <form onSubmit={handleIzinSubmit} className="space-y-5">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori Ketidakhadiran</label>
                <select 
                  value={formIzin.jenis}
                  onChange={(e) => setFormIzin({...formIzin, jenis: e.target.value})}
                  className="w-full mt-1 p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-red-600 outline-none"
                >
                  <option value="Izin">Izin (Keperluan Mendesak)</option>
                  <option value="Sakit">Sakit (Butuh Istirahat)</option>
                  <option value="Cuti">Cuti Tahunan</option>
                  <option value="Dinas Luar">Dinas Luar / Pelatihan</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Alasan Detail</label>
                <textarea 
                  required
                  value={formIzin.keterangan}
                  onChange={(e) => setFormIzin({...formIzin, keterangan: e.target.value})}
                  className="w-full mt-1 p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-red-600 h-32 outline-none"
                  placeholder="Tuliskan alasan Anda..."
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Lampiran Foto / Bukti</label>
                <input 
                  type="file" 
                  onChange={(e) => setFormIzin({...formIzin, file: e.target.files?.[0]})}
                  className="w-full mt-1 p-3 text-xs text-slate-500 cursor-pointer"
                />
              </div>
              <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg shadow-red-200 hover:bg-red-700 transition active:scale-95">
                Kirim Permohonan
              </button>
            </form>
          </div>
        )}
      </div>
      <style jsx global>{`
        .bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }
      `}</style>
    </div>
  );
}
