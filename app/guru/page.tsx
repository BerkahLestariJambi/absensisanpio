"use client";
import { useState, useEffect, Suspense } from "react"; // Tambahkan Suspense
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";

// 1. Pindahkan logika utama ke komponen internal
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      let fetchUrl = "";
      let headers: any = { "Accept": "application/json" };

      if (guruIdFromUrl) {
        fetchUrl = `${API_URL}/cek-status-absen/${guruIdFromUrl}`;
      } else {
        const token = localStorage.getItem("auth_token");
        if (!token) {
          router.push("/");
          return;
        }
        headers["Authorization"] = `Bearer ${token}`;
        fetchUrl = `${API_URL}/guru/rekap-pribadi`;
      }

      const resStatus = await fetch(fetchUrl, { headers });
      const statusJson = await resStatus.json();

      if (statusJson.success) {
        setProfile({
          nama_lengkap: statusJson.nama || statusJson.user?.nama_lengkap,
          nip: statusJson.user?.nip || "-"
        });

        // Ambil rekap (Pastikan endpoint ini bisa diakses publik)
        const resRekap = await fetch(`${API_URL}/admin/rekap-absensi`);
        const allData = await resRekap.json();
        
        const myId = guruIdFromUrl || statusJson.user?.id;
        const rawData = Array.isArray(allData) ? allData.filter((item: any) => item.guru_id == myId) : [];

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

        setMyRekap(Object.values(grouped).sort((a: any, b: any) => b.tanggalRaw.getTime() - a.tanggalRaw.getTime()));

        const todayKey = new Date().toLocaleDateString('en-CA');
        if (grouped[todayKey]) {
          setTodayStatus({ masuk: grouped[todayKey].masuk, pulang: grouped[todayKey].pulang });
        }
      }
    } catch (err) {
      console.error("Gagal sinkronisasi data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [guruIdFromUrl]);

  const handleIzinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formIzin.keterangan) return Swal.fire("Opps", "Alasan harus diisi", "warning");

    const formData = new FormData();
    formData.append("guru_id", guruIdFromUrl || profile?.id);
    formData.append("jenis", formIzin.jenis);
    formData.append("keterangan", formIzin.keterangan);
    if (formIzin.file) formData.append("foto_bukti", formIzin.file);

    Swal.fire({ title: "Mengirim...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
      const res = await fetch(`${API_URL}/guru/ajukan-izin`, { method: "POST", body: formData });
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#fdf5e6]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf5e6] p-4 md:p-8 bg-batik animate-in fade-in duration-700">
      {/* ... (Gunakan kode UI return Anda di sini tanpa perubahan) ... */}
      <div className="max-w-4xl mx-auto">
          {/* Header, Quick Status, Nav, dan Tab Content Anda tetap sama */}
          {/* Copy paste sisa kode UI Anda ke sini */}
      </div>
      <style jsx global>{`.bg-batik { background-image: url("https://www.transparenttextures.com/patterns/batik.png"); }`}</style>
    </div>
  );
}

// 2. Export default yang dibungkus Suspense
export default function GuruDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
