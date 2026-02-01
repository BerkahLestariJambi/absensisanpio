import type { Metadata, Viewport } from "next";
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

// Konfigurasi Viewport untuk mobile agar tidak zoom otomatis pada input
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#dc2626", // Warna merah sesuai tema aplikasi Anda
};

const BASE_API_URL = "https://backendabsen.mejatika.com";

export async function generateMetadata(): Promise<Metadata> {
  try {
    // Mengambil data setting dengan revalidate 60 detik
    const res = await fetch(`${BASE_API_URL}/api/setting-app`, {
      next: { revalidate: 60 },
    });
    
    const result = await res.json();
    const d = result.success ? result.data : result;

    // Ambil data spesifik dari key-value store backend
    const schoolName = d?.nama_sekolah || "Sistem Absensi Online";
    const logoPath = d?.logo_sekolah;
    
    // Logika penentuan URL Favicon
    // Kita tambahkan random query string (?v=...) agar browser dipaksa refresh icon jika ada perubahan
    const version = Date.now();
    const faviconUrl = logoPath 
      ? `${BASE_API_URL}/storage/${logoPath}?v=${version}` 
      : "/favicon.ico";

    return {
      title: {
        template: `%s | ${schoolName}`,
        default: schoolName,
      },
      description: `Sistem Informasi Absensi Online Resmi - ${schoolName}. Pantau kehadiran pegawai secara real-time.`,
      metadataBase: new URL(BASE_API_URL),
      icons: {
        icon: [
          { url: faviconUrl },
          { url: faviconUrl, sizes: "32x32", type: "image/png" },
        ],
        apple: [
          { url: faviconUrl, sizes: "180x180", type: "image/png" },
        ],
      },
      manifest: "/manifest.json", // Opsional jika Anda ingin membuat PWA
    };
  } catch (error) {
    console.error("Metadata fetch error:", error);
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
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-slate-50`}
      >
        {children}
      </body>
    </html>
  );
}
