"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function KepsekDashboard() {
  const router = useRouter();
  const [izins, setIzins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [jenjangTujuan, setJenjangTujuan] = useState(""); 

  const API_URL = "https://backendabsen.mejatika.com/api";

  // --- LOGIKA FILTER SUPER KETAT ---
  const filteredIzins = izins.filter((i) => {
    if (userRole === "super_admin") return true;
    
    // DEBUG: Cek di console browser untuk melihat data yang masuk
    // console.log("Data Guru:", i.guru?.nama_lengkap, "Jenjang:", i.guru?.jenjang);

    const jenjangGuru = i.guru?.jenjang?.toString().trim().toUpperCase();
    const roleTarget = userRole === "kepsek_smp" ? "SMP" : userRole === "kepsek_sma" ? "SMA" : "";

    // Hanya tampilkan jika Jenjang Guru sama persis dengan Role Kepsek
    return jenjangGuru === roleTarget;
  });

  const pendingIzins = filteredIzins.filter(i => i.status === "Pending");

  const fetchData = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/daftar-izin`, {
        headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json" }
      });
      const data = await res.json();
      setIzins(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem("user_role"); // pastikan isinya 'kepsek_smp' atau 'kepsek_sma'
    const name = localStorage.getItem("user_name");
    
    if (!role) {
      router.push("/admin/login");
    } else {
      setUserRole(role);
      setUserName(name);
      setJenjangTujuan(role === "kepsek_smp" ? "SMP" : "SMA");
      fetchData();
    }
  }, []);

  // ... (handleAction function tetap sama)
