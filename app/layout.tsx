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

// FUNGSI DINAMIS UNTUK TITLE DAN FAVICON
export async function generateMetadata(): Promise<Metadata> {
  const API_URL = "https://backendabsen.mejatika.com";
  
  try {
    const res = await fetch(`${API_URL}/api/setting-app`, {
      next: { revalidate: 60 }, 
    });
    const result = await res.json();
    
    // Ambil data dari backend (sesuaikan dengan struktur JSON Anda)
    const d = result.success ? result.data : result;
    const schoolName = d?.nama_sekolah || "Sistem Absensi";
    const logoPath = d?.logo_sekolah;

    // Link logo lengkap ke storage backend
    const faviconUrl = logoPath 
      ? `${API_URL}/storage/${logoPath}` 
      : "/favicon.ico"; // Fallback ke favicon default jika logo kosong

    return {
      title: `Absensi - ${schoolName}`,
      description: `Sistem Informasi Absensi Online Resmi ${schoolName}`,
      icons: {
        icon: faviconUrl, // Ini yang mengganti logo React di tab browser
        apple: faviconUrl,
      },
    };
  } catch (error) {
    return {
      title: "Sistem Absensi Online",
      icons: {
        icon: "/favicon.ico",
      },
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
