const BASE_URL = 'https://projeckkelasxi.mejatika.com/api';

/**
 * Helper Fetch Engine
 */
async function fetcher(endpoint, options = {}) {
  const { method = 'GET', body, headers = {} } = options;

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers,
    },
    cache: 'no-store', // Penting untuk data absensi agar tidak caching
  };

  if (body) config.body = JSON.stringify(body);

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw {
      status: response.status,
      message: errorData.message || 'Terjadi kesalahan sistem',
      errors: errorData.errors || null,
    };
  }

  return response.json();
}

/**
 * API Client Library
 */
export const api = {
  // 1. SISTEM & KONFIGURASI
  system: {
    getConfig: () => fetcher('/setting-app'),
    getReferensiGuru: () => fetcher('/admin/guru/referensi'),
  },

  // 2. LOGIKA ABSENSI (CORE)
  absensi: {
    // Cek apakah guru sudah absen masuk/pulang hari ini
    checkStatus: (guruId) => fetcher(`/cek-status-absen/${guruId}`),
    
    // Simpan data absensi (Biometrik + Geo + Image)
    store: (payload) => fetcher('/simpan-absen', {
      method: 'POST',
      body: payload 
      /* Payload berisi: { guru_id, lat, lng, image, status_tambahan } */
    }),
    
    // Ambil semua data absensi (untuk admin/rekap)
    getAll: () => fetcher('/absensi'),
  },

  // 3. MANAJEMEN GURU (CRUD)
  guru: {
    list: () => fetcher('/gurus'),
    show: (id) => fetcher(`/gurus/${id}`),
    store: (data) => fetcher('/gurus', { method: 'POST', body: data }),
    update: (id, data) => fetcher(`/gurus/${id}`, { method: 'PUT', body: data }),
    delete: (id) => fetcher(`/gurus/${id}`, { method: 'DELETE' }),
  }
};
