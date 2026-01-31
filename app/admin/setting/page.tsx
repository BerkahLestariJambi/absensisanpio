"use client";
import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

export default function AdminSetting() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentLoc, setCurrentLoc] = useState<{lat: number, lng: number} | null>(null);
  
  const [formData, setFormData] = useState({
    nama_sekolah: "",
    tahun_pelajaran: "",
    semester: "",
    jam_pulang_normal: "",
    jam_pulang_cepat_mulai: "",
    lat_sekolah: "", // Tambahan field koordinat
    lng_sekolah: "", // Tambahan field koordinat
    logo_sekolah: null as File | null,
    current_logo: ""
  });

  useEffect(() => {
    // Ambil data config
    const loadConfig = async () => {
      try {
        const res = await fetch("https://backendabsen.mejatika.com/api/setting-app");
        const result = await res.json();
        if (result.success) {
          const d = result.data;
          setFormData({
            nama_sekolah: d.nama_sekolah || "",
            tahun_pelajaran: d.tahun_pelajaran || "",
            semester: d.semester || "1",
            jam_pulang_normal: d.jam_pulang_normal || "12:45",
            jam_pulang_cepat_mulai: d.jam_pulang_cepat_mulai || "07:15",
            lat_sekolah: d.lat_sekolah || "",
            lng_sekolah: d.lng_sekolah || "",
            logo_sekolah: null,
            current_logo: d.logo_sekolah || ""
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Deteksi lokasi Admin saat buka setting
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCurrentLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }

    loadConfig();
  }, []);

  const handleAmbilLokasi = () => {
    if (currentLoc) {
      setFormData({
        ...formData,
        lat_sekolah: currentLoc.lat.toString(),
        lng_sekolah: currentLoc.lng.toString()
      });
      Swal.fire("Lokasi Terdeteksi", "Koordinat berhasil disalin ke form.", "success");
    } else {
      Swal.fire("Gagal", "Pastikan GPS aktif dan izin lokasi diberikan.", "error");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const dataToSend = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key !== 'logo_sekolah' && key !== 'current_logo') dataToSend.append(key, value as string);
    });
    if (formData.logo_sekolah) dataToSend.append("logo_sekolah", formData.logo_sekolah);

    try {
      const res = await fetch("https://backendabsen.mejatika.com/api/admin/setting-update", {
        method: "POST",
        body: dataToSend,
      });
      if (res.ok) {
        Swal.fire("BERHASIL", "Pengaturan & Lokasi Sekolah diperbarui", "success");
      }
    } catch (err) {
      Swal.fire("Error", "Gagal menyimpan", "error");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-10 text-center">Memuat...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-[30px] shadow-xl overflow-hidden">
        <div className="bg-red-600 p-6 text-white font-black text-center uppercase tracking-widest">
          Konfigurasi & Geofencing
        </div>
        
        <form onSubmit={handleUpdate} className="p-8 space-y-6">
          {/* ... field nama sekolah dll sama seperti sebelumnya ... */}

          {/* SECTION LOKASI (GEOFENCING) */}
          <div className="p-5 bg-blue-50 rounded-3xl border border-blue-100 space-y-4">
             <h3 className="text-[10px] font-black text-blue-600 uppercase">📍 Titik Pusat Absensi (Geofencing)</h3>
             <div className="grid grid-cols-2 gap-4">
                <input 
                  type="text" placeholder="Latitude" value={formData.lat_sekolah} readOnly
                  className="p-3 bg-white rounded-xl border border-blue-200 text-xs font-mono"
                />
                <input 
                  type="text" placeholder="Longitude" value={formData.lng_sekolah} readOnly
                  className="p-3 bg-white rounded-xl border border-blue-200 text-xs font-mono"
                />
             </div>
             <button 
                type="button" onClick={handleAmbilLokasi}
                className="w-full py-3 bg-blue-600 text-white text-[10px] font-black rounded-xl hover:bg-blue-700 transition-all shadow-md"
             >
                🎯 GUNAKAN LOKASI SAYA SAAT INI
             </button>
             <p className="text-[9px] text-blue-400 italic">* Berdirilah di tengah area sekolah/kantor saat menekan tombol ini.</p>
          </div>

          <button type="submit" disabled={saving} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black">
            {saving ? "MENYIMPAN..." : "SIMPAN SEMUA PENGATURAN"}
          </button>
        </form>
      </div>
    </div>
  );
}
