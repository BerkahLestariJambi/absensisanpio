"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("rekap");
  const [subTabIzin, setSubTabIzin] = useState("Semua");
  const [gurus, setGurus] = useState<any[]>([]);
  const [izins, setIzins] = useState<any[]>([]);
  const [rekap, setRekap] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter tanggal untuk rekap & export
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  const [schoolName, setSchoolName] = useState("Memuat...");
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  // State notifikasi
  const [pendingCount, setPendingCount] = useState(0);

  const API_URL = "https://backendabsen.mejatika.com/api";

  // --- LOGIKA FILTERING & BADGE IZIN ---
  const getPendingCountLocal = (jenis: string) => {
    if (jenis === "Semua") return izins.filter((i) => i.status === "Pending").length;
    return izins.filter((i) => i.jenis === jenis && i.status === "Pending").length;
  };

  const filteredIzins =
    subTabIzin === "Semua" ? izins : izins.filter((i) => i.jenis === subTabIzin);

  // --- FILTER REKAP BERDASARKAN TANGGAL ---
  const filteredRekap = rekap.filter((r) => {
    const itemDate = new Date(r.waktu_absen).toISOString().slice(0, 10);
    if (filterStartDate && itemDate < filterStartDate) return false;
    if (filterEndDate && itemDate > filterEndDate) return false;
    return true;
  });

  // --- FUNGSI EXPORT EXCEL (.XLS / HTML TABLE YANG RAPI DI EXCEL) ---
  const handleExportExcel = () => {
    if (filteredRekap.length === 0) {
      Swal.fire("Data Kosong", "Tidak ada data rekap absensi untuk diexport.", "info");
      return;
    }

    const periodeText =
      filterStartDate || filterEndDate
        ? `Periode: ${filterStartDate || "Awal"} s/d ${filterEndDate || "Sekarang"}`
        : "Semua Periode";

    let tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8" /></head>
      <body>
        <h3>REKAPITULASI ABSENSI PEGAWAI - ${schoolName.toUpperCase()}</h3>
        <p>${periodeText}</p>
        <table border="1" style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="background-color: #1e293b; color: #ffffff; font-weight: bold;">
              <th>No</th>
              <th>Nama Pegawai</th>
              <th>NIP / NUPTK</th>
              <th>Tanggal</th>
              <th>Jam Masuk</th>
              <th>Status Masuk</th>
              <th>Jam Pulang</th>
              <th>Status Pulang</th>
              <th>Lokasi Masuk</th>
            </tr>
          </thead>
          <tbody>
    `;

    filteredRekap.forEach((r, index) => {
      const tanggal = new Date(r.waktu_absen).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const jamMasuk = r.data_masuk
        ? new Date(r.data_masuk.waktu_absen).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "-";
      const statusMasuk = r.data_masuk ? r.data_masuk.status : "Belum Scan";
      const jamPulang = r.data_pulang
        ? new Date(r.data_pulang.waktu_absen).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : "-";
      const statusPulang = r.data_pulang ? r.data_pulang.status : "Belum Scan";
      const lokasi = r.data_masuk?.keterangan_lokasi || r.data_pulang?.keterangan_lokasi || "-";

      tableHTML += `
        <tr>
          <td style="text-align:center;">${index + 1}</td>
          <td>${r.nama_lengkap || "-"}</td>
          <td>'${r.nip || r.nuptk || "-"}</td>
          <td style="text-align:center;">${tanggal}</td>
          <td style="text-align:center;">${jamMasuk}</td>
          <td style="text-align:center;">${statusMasuk}</td>
          <td style="text-align:center;">${jamPulang}</td>
          <td style="text-align:center;">${statusPulang}</td>
          <td>${lokasi}</td>
        </tr>
      `;
    });

    tableHTML += `</tbody></table></body></html>`;

    const blob = new Blob([tableHTML], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rekap_Absensi_${schoolName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- FUNGSI CETAK / EXPORT PDF ---
  const handlePrintRekap = () => {
    if (filteredRekap.length === 0) {
      Swal.fire("Data Kosong", "Tidak ada data rekap absensi untuk dicetak.", "info");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const periodeText =
      filterStartDate || filterEndDate
        ? `Periode: ${filterStartDate || "Awal"} s/d ${filterEndDate || "Sekarang"}`
        : "Semua Periode";

    const rowsHtml = filteredRekap
      .map((r, idx) => {
        const tanggal = new Date(r.waktu_absen).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        const jamMasuk = r.data_masuk
          ? new Date(r.data_masuk.waktu_absen).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            })
          : "-";
        const jamPulang = r.data_pulang
          ? new Date(r.data_pulang.waktu_absen).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            })
          : "-";

        return `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td><strong>${r.nama_lengkap}</strong><br/><small>${r.nip || "-"}</small></td>
            <td style="text-align:center;">${tanggal}</td>
            <td style="text-align:center;">${jamMasuk} (${r.data_masuk?.status || "-"})</td>
            <td style="text-align:center;">${jamPulang} (${r.data_pulang?.status || "-"})</td>
          </tr>
        `;
      })
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Rekap Absensi - ${schoolName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
            h2 { margin: 0; text-transform: uppercase; }
            p { margin: 4px 0 16px; font-size: 12px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; }
            th { background-color: #1e293b; color: white; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <h2>REKAPITULASI KEHADIRAN PEGAWAI - ${schoolName}</h2>
          <p>${periodeText} | Dicetak pada: ${new Date().toLocaleString("id-ID")}</p>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Nama & NIP</th>
                <th>Tanggal</th>
                <th>Masuk</th>
                <th>Pulang</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --- FETCH STATS (NOTIFIKASI) ---
  const fetchStats = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/admin/pengajuan/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPendingCount(data.pending_count);
      }
    } catch (err) {
      console.error("Gagal ambil notifikasi");
    }
  };

  // --- LOAD DATA ---
  const loadData = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return router.push("/admin/login");

    setLoading(true);
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };

      const [resGuru, resIzin, resRekap, resSetting] = await Promise.all([
        fetch(`${API_URL}/admin/guru`, { headers }),
        fetch(`${API_URL}/admin/daftar-izin`, { headers }),
        fetch(`${API_URL}/admin/rekap-absensi`, { headers }),
        fetch(`${API_URL}/setting-app`),
      ]);

      const dataGuru = await resGuru.json();
      const dataIzin = await resIzin.json();
      const dataRekap = await resRekap.json();
      const dataSetting = await resSetting.json();

      setGurus(Array.isArray(dataGuru) ? dataGuru : dataGuru.data || []);
      setIzins(Array.isArray(dataIzin) ? dataIzin : dataIzin.data || []);

      const rawRekap = Array.isArray(dataRekap) ? dataRekap : dataRekap.data || [];
      const grouped = rawRekap.reduce((acc: any, curr: any) => {
        const dateKey = new Date(curr.waktu_absen).toLocaleDateString("id-ID");
        const key = `${curr.nama_lengkap}-${dateKey}`;
        if (!acc[key]) {
          acc[key] = { ...curr, data_masuk: null, data_pulang: null };
        }
        const statusLower = curr.status ? curr.status.toLowerCase() : "";
        if (statusLower.includes("masuk") || statusLower.includes("terlambat")) {
          acc[key].data_masuk = curr;
        } else if (statusLower.includes("pulang")) {
          acc[key].data_pulang = curr;
        }
        return acc;
      }, {});
      setRekap(Object.values(grouped));

      if (dataSetting.success && dataSetting.data) {
        setSchoolName(dataSetting.data.nama_sekolah || "SANPIO");
        setSchoolLogo(dataSetting.data.logo_sekolah || null);
      }

      fetchStats();
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

      const interval = setInterval(fetchStats, 60000);
      return () => clearInterval(interval);
    }
  }, []);

  // --- ACTIONS ---
  const handleLogout = () => {
    localStorage.clear();
    router.push("/admin/login");
  };

  const handleImportExcel = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    Swal.fire({ title: "Mengunggah...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await fetch(`${API_URL}/admin/guru/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        body: formData,
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

  const updateStatusIzin = async (id: number, status: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/izin/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
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
              <img
                src={`https://backendabsen.mejatika.com/storage/${schoolLogo}`}
                className="w-full h-full object-contain"
                alt="Logo"
              />
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
          <button
            onClick={() => window.open("/", "_blank")}
            className="bg-amber-50 text-amber-600 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-amber-100 transition uppercase border border-amber-100"
          >
            🖥️ Buka Mesin
          </button>
          <button
            onClick={loadData}
            className={`bg-slate-100 p-3 rounded-xl hover:bg-slate-200 transition ${loading ? "animate-spin" : ""}`}
          >
            🔄
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-50 text-red-600 px-6 py-2 rounded-xl font-black text-xs hover:bg-red-600 hover:text-white transition border border-red-100 uppercase tracking-widest"
          >
            🚪 Keluar
          </button>
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
            className={`relative py-2.5 px-6 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-2 ${
              activeTab === tab.id ? "bg-red-600 text-white shadow-xl shadow-red-200" : "text-slate-400 hover:bg-slate-50"
            }`}
          >
            <span>{tab.icon}</span> {tab.label}

            {tab.id === "izin" && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-white text-red-600 text-[8px] font-black items-center justify-center border border-red-100">
                  {pendingCount}
                </span>
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
                <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest ml-2">
                  Manajemen Data Pegawai
                </h2>
                <p className="text-[10px] text-slate-400 ml-2 font-bold italic">Total: {gurus.length} Orang</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <label className="cursor-pointer bg-green-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black hover:bg-green-700 transition shadow-lg flex items-center gap-2">
                  📥 IMPORT EXCEL
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportExcel} />
                </label>
                <button
                  onClick={() => router.push("/admin/pegawai/tambah")}
                  className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black hover:scale-105 transition shadow-lg flex items-center gap-2"
                >
                  + TAMBAH GURU
                </button>
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
                      <td className="p-6 text-xs font-bold text-slate-500">
                        {g.nip || "-"} / {g.nuptk || "-"}
                      </td>
                      <td className="p-6 text-center">
                        <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[9px] font-black uppercase">
                          Aktif
                        </span>
                      </td>
                      <td className="p-6 text-center">
                        <button
                          onClick={() => router.push(`/admin/pegawai/edit/${g.id}`)}
                          className="bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 transition p-2 rounded-lg text-[10px] font-black"
                        >
                          ✏️ EDIT
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB KEHADIRAN (DENGAN FILTER TANGGAL & EXPORT EXCEL / CETAK PDF) */}
        {activeTab === "rekap" && (
          <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Rekap Absensi Harian</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                  1 Baris Per Pegawai / Hari • Zona Waktu: WITA
                </p>
              </div>

              {/* FILTER TANGGAL & TOMBOL EXPORT */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none focus:border-red-500"
                  title="Dari Tanggal"
                />
                <span className="text-[10px] font-bold text-slate-400">s/d</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 outline-none focus:border-red-500"
                  title="Sampai Tanggal"
                />
                {(filterStartDate || filterEndDate) && (
                  <button
                    onClick={() => {
                      setFilterStartDate("");
                      setFilterEndDate("");
                    }}
                    className="px-2.5 py-2 bg-slate-200 text-slate-600 rounded-xl text-[9px] font-black hover:bg-slate-300 transition"
                  >
                    RESET
                  </button>
                )}

                <button
                  onClick={handleExportExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md transition active:scale-95 flex items-center gap-1.5"
                >
                  📊 EXPORT EXCEL
                </button>

                <button
                  onClick={handlePrintRekap}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md transition active:scale-95 flex items-center gap-1.5"
                >
                  🖨️ CETAK / PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800 text-white uppercase text-[9px] font-black tracking-widest">
                  <tr>
                    <th rowSpan={2} className="p-6 text-left border-r border-slate-700">
                      Pegawai
                    </th>
                    <th rowSpan={2} className="p-6 text-center border-r border-slate-700">
                      Tanggal
                    </th>
                    <th colSpan={2} className="p-4 text-center border-b border-slate-700">
                      Jam & Status Scan
                    </th>
                    <th rowSpan={2} className="p-6 text-center">
                      Lokasi
                    </th>
                  </tr>
                  <tr>
                    <th className="p-4 text-center border-r border-slate-700 bg-slate-800 text-red-400">Masuk</th>
                    <th className="p-4 text-center border-r border-slate-700 bg-slate-800 text-blue-400">Pulang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredRekap.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition text-xs font-medium">
                      <td className="p-6 border-r">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              r.data_masuk?.foto_wajah || r.data_pulang?.foto_wajah
                                ? `https://backendabsen.mejatika.com/storage/${
                                    r.data_masuk?.foto_wajah || r.data_pulang?.foto_wajah
                                  }`
                                : "/no-avatar.png"
                            }
                            className="w-10 h-10 object-cover rounded-xl border border-slate-200"
                            alt="F"
                          />
                          <div>
                            <div className="font-black text-slate-800 uppercase text-xs">{r.nama_lengkap}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase">{r.nip || "No NIP"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6 text-center border-r font-bold text-slate-700 uppercase">
                        {new Date(r.waktu_absen).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="p-4 text-center border-r min-w-[130px]">
                        {r.data_masuk ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-black text-slate-700">
                              {new Date(r.data_masuk.waktu_absen).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "UTC",
                              })}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                                r.data_masuk.status.includes("Terlambat")
                                  ? "bg-orange-100 text-orange-600"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {r.data_masuk.status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-200 text-[10px] font-black italic">BELUM SCAN</span>
                        )}
                      </td>
                      <td className="p-4 text-center border-r min-w-[130px]">
                        {r.data_pulang ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-black text-blue-700">
                              {new Date(r.data_pulang.waktu_absen).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "UTC",
                              })}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-blue-100 text-blue-700">
                              {r.data_pulang.status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-200 text-[10px] font-black italic">BELUM SCAN</span>
                        )}
                      </td>
                      <td className="p-6 text-center">
                        <a
                          href={`https://www.google.com/maps?q=${
                            r.data_masuk?.latitude || r.data_pulang?.latitude
                          },${r.data_masuk?.longitude || r.data_pulang?.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block w-7 h-7 leading-7 bg-slate-100 rounded-lg text-sm hover:bg-red-600 hover:text-white transition"
                        >
                          📍
                        </a>
                      </td>
                    </tr>
                  ))}
                  {filteredRekap.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-16 text-center font-bold text-slate-300 uppercase text-xs tracking-widest">
                        Tidak ada data kehadiran pada rentang tanggal ini
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB IZIN & SAKIT */}
        {activeTab === "izin" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-2">
              {["Semua", "Izin", "Sakit", "Cuti", "Tugas Luar"].map((type) => (
                <button
                  key={type}
                  onClick={() => setSubTabIzin(type)}
                  className={`relative py-3 px-6 rounded-2xl text-[9px] font-black uppercase transition-all border ${
                    subTabIzin === type
                      ? "bg-slate-800 text-white border-slate-800 shadow-lg"
                      : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  {type}
                  {getPendingCountLocal(type) > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[9px] animate-bounce border-2 border-white">
                      {getPendingCountLocal(type)}
                    </span>
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
                    {filteredIzins.map((i) => {
                      const buktiFile = i.bukti_dokumen || i.foto_bukti;
                      const buktiUrl =
                        i.bukti_dokumen_url ||
                        (buktiFile ? `https://backendabsen.mejatika.com/storage/${buktiFile}` : null);

                      return (
                        <tr key={i.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-6">
                            <div className="font-black text-slate-800 uppercase text-xs">{i.guru?.nama_lengkap}</div>
                            <div className="text-[9px] text-slate-400 font-bold italic">
                              Request: {new Date(i.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="p-6 text-xs">
                            <span
                              className={`font-black px-2 py-0.5 rounded uppercase mb-1 inline-block ${
                                i.jenis === "Sakit"
                                  ? "bg-amber-100 text-amber-600"
                                  : i.jenis === "Tugas Luar" || i.jenis === "Dinas Luar"
                                  ? "bg-purple-100 text-purple-600"
                                  : "bg-blue-100 text-blue-600"
                              }`}
                            >
                              {i.jenis}
                            </span>

                            <div className="flex flex-col gap-1 mt-1">
                              <div className="text-slate-800 font-black text-[10px] uppercase">
                                📅{" "}
                                {i.tanggal_mulai ? (
                                  <>
                                    {new Date(i.tanggal_mulai).toLocaleDateString("id-ID", {
                                      day: "2-digit",
                                      month: "short",
                                    })}
                                    {i.tanggal_selesai &&
                                      ` s/d ${new Date(i.tanggal_selesai).toLocaleDateString("id-ID", {
                                        day: "2-digit",
                                        month: "short",
                                      })}`}
                                    {i.jenis === "Sakit" && !i.tanggal_selesai && (
                                      <span className="ml-1 text-red-500 font-bold">(Hingga Sembuh)</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-slate-400 italic">Tanggal tidak terdata</span>
                                )}
                              </div>
                              <div className="text-slate-500 font-medium italic">"{i.keterangan}"</div>
                            </div>
                          </td>
                          <td className="p-6 text-center">
                            {buktiUrl ? (
                              <button
                                onClick={() => window.open(buktiUrl, "_blank")}
                                className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[9px] font-black hover:bg-red-600 hover:text-white transition uppercase"
                              >
                                Lihat Bukti
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-6 text-center">
                            <span
                              className={`text-[9px] font-black px-3 py-1 rounded-full border uppercase ${
                                i.status === "Disetujui"
                                  ? "bg-green-50 text-green-600 border-green-100"
                                  : i.status === "Ditolak"
                                  ? "bg-red-50 text-red-600 border-red-100"
                                  : "bg-amber-50 text-amber-600 border-amber-100"
                              }`}
                            >
                              {i.status}
                            </span>
                          </td>
                          <td className="p-6 text-center">
                            <div className="flex justify-center gap-2">
                              {i.status === "Pending" && (
                                <>
                                  <button
                                    onClick={() => updateStatusIzin(i.id, "Disetujui")}
                                    className="bg-green-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black hover:bg-green-700 transition"
                                  >
                                    Setuju
                                  </button>
                                  <button
                                    onClick={() => updateStatusIzin(i.id, "Ditolak")}
                                    className="bg-red-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black hover:bg-red-700 transition"
                                  >
                                    Tolak
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredIzins.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-20 text-center font-bold text-slate-300 uppercase text-xs tracking-widest italic"
                        >
                          Tidak ada data {subTabIzin}
                        </td>
                      </tr>
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
            <div className="w-24 h-24 bg-red-50 text-red-600 rounded-[30px] flex items-center justify-center text-4xl mx-auto shadow-inner rotate-3">
              ⚙️
            </div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Konfigurasi Aplikasi</h2>
            <button
              onClick={() => router.push("/admin/setting")}
              className="bg-red-600 text-white px-10 py-4 rounded-[20px] font-black text-xs tracking-widest hover:bg-red-700 transition shadow-xl shadow-red-100"
            >
              BUKA PANEL PENGATURAN
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        .bg-batik {
          background-image: url("https://www.transparenttextures.com/patterns/batik.png");
          background-attachment: fixed;
        }
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
