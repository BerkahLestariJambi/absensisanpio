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
        // Simpan token/status login di local storage
        localStorage.setItem("admin_authenticated", "true");
        
        Swal.fire({
          title: "Login Berhasil!",
          text: "Selamat datang di Panel Admin Sanpio.",
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
      Swal.fire("Error", "Gagal terhubung ke server.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
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
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-700"
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
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-700"
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-95 ${
              loading ? "bg-slate-400" : "bg-blue-700 hover:bg-blue-800 shadow-blue-100"
            }`}
          >
            {loading ? "AUTHENTICATING..." : "SIGN IN TO PANEL"}
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
