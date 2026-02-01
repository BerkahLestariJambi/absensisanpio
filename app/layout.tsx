import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// FUNGSI UNTUK GENERATE METADATA SECARA DINAMIS
export async function generateMetadata(): Promise<Metadata> {
  try {
    // Ambil data dari API setting
    const res = await fetch("https://backendabsen.mejatika.com/api/setting-app", {
      next: { revalidate: 60 }, // Cache data selama 60 detik
    });
    const result = await res.json();
    
    // Ambil nama sekolah dari data (sesuaikan struktur JSON backend Anda)
    const schoolName = result.success ? result.data.nama_sekolah : result.nama_sekolah;

    return {
      title: schoolName ? `Absensi Online - ${schoolName}` : "Sistem Absensi Online",
      description: `Sistem Informasi Absensi Online Resmi ${schoolName || ""}`,
    };
  } catch (error) {
    // Fallback jika API gagal
    return {
      title: "Sistem Absensi Online",
      description: "Sistem Informasi Absensi Online",
    };
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
