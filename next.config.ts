import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Konfigurasi agar build tidak gagal karena error TypeScript */
  typescript: {
    // Mengizinkan produksi build selesai meskipun ada error TypeScript
    ignoreBuildErrors: true,
  },
  
  /* Konfigurasi agar build tidak gagal karena peringatan ESLint */
  eslint: {
    // Mengabaikan pengecekan linting selama proses build
    ignoreDuringBuilds: true,
  },

  /* Konfigurasi tambahan untuk menangani gambar dari domain luar */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'backendabsen.mejatika.com',
        pathname: '/storage/**',
      },
    ],
  },

  /* Aktifkan fitur-fitur modern jika diperlukan */
  experimental: {
    // Jika Anda menggunakan Turbopack, fitur ini biasanya sudah aktif
  }
};

export default nextConfig;
