// components/VoiceAnnouncer.ts

/**
 * Utility untuk menjalankan instruksi suara menggunakan Web Speech API
 */
export const playVoice = (text: string) => {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    // Batalkan suara yang sedang berjalan agar tidak tumpang tindih/antri terlalu lama
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Setel bahasa ke Indonesia
    utterance.lang = "id-ID";
    
    // Kecepatan (0.1 - 10), 1.0 adalah normal
    utterance.rate = 1.0; 
    
    // Nada (0 - 2), 1.0 adalah normal
    utterance.pitch = 1.0;

    // Menangani ketersediaan suara di beberapa browser
    const voices = window.speechSynthesis.getVoices();
    // Cari suara Indonesia jika tersedia
    const idVoice = voices.find(v => v.lang.includes("id-ID"));
    if (idVoice) {
      utterance.voice = idVoice;
    }

    window.speechSynthesis.speak(utterance);
  } else {
    console.warn("Browser ini tidak mendukung fitur instruksi suara.");
  }
};
