"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function LoginAdmin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("https://backendabsen.mejatika.com/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // --- PROSES PENYIMPANAN SESSION ---
        // Kita simpan status autentikasi, role, dan nama user
        localStorage.setItem("admin_authenticated", "true");
        localStorage.setItem("user_role", data.user.role); // super_admin, kepsek_smp, atau kepsek_sma
        localStorage.setItem("user_name", data.user.name);
        
        // Jika backend mengirimkan token (Sanctum), simpan di sini
        if (data.token) {
          localStorage.setItem("auth_token", data.token);
        }
        
        Swal.fire({
          title: "Login Berhasil!",
          text: `Selamat datang, ${data.user.name}`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false
        });

        // Arahkan ke Dashboard
        router.push("/admin/dashboard");
      } else {
        Swal.fire("Gagal", data.message || "Email atau Password salah!", "error");
      }
    } catch (error) {
      Swal.fire("Error", "Gagal terhubung ke server. Pastikan API Backend aktif.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-[30px] shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Header Visual */}
        <div className="bg-blue-700 p-10 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto flex items-center justify-center mb-4 backdrop-blur-md">
            <span className="text-white text-2xl font-black">🔐</span>
          </div>
          <h1 className="text-white text-xl font-bold tracking-tight">Admin Gateway</h1>
          <p className="text-blue-200 text-xs uppercase tracking-widest mt-1">Sanpio Digital System</p>
        </div>

        {/* Form Login */}
        <form onSubmit={handleLogin} className="p-8 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-700 placeholder:text-slate-300"
              placeholder="admin@mejatika.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-700 placeholder:text-slate-300"
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center ${
              loading ? "bg-slate-400 cursor-not-allowed" : "bg-blue-700 hover:bg-blue-800 shadow-blue-100"
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                AUTHENTICATING...
              </>
            ) : "SIGN IN TO PANEL"}
          </button>

          <button 
            type="button"
            onClick={() => router.push("/")}
            className="w-full text-slate-400 text-xs font-medium hover:text-slate-600 transition"
          >
            ← Kembali ke Halaman Absensi
          </button>
        </form>
      </div>
    </div>
  );
}
