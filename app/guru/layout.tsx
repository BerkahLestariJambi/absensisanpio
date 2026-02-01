// app/guru/layout.tsx
"use client";

import React from "react";

export default function GuruLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans bg-batik">
      {/* Container utama dengan z-index agar konten selalu di atas background */}
      <div className="max-w-5xl mx-auto relative z-10">
        {children}
      </div>

      <style jsx global>{`
        .bg-batik {
          background-image: url("https://www.transparenttextures.com/patterns/batik.png");
          background-attachment: fixed;
          background-repeat: repeat;
        }
        
        /* Scrollbar styling - Modern & Minimalist */
        ::-webkit-scrollbar { 
          width: 6px; 
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb { 
          background: #e2e8f0; 
          border-radius: 20px; 
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }

        /* Smooth scroll untuk perpindahan antar tab */
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
