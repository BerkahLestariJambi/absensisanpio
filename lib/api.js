const BASE_URL = 'https://projeckkelasxi.mejatika.com/api';

/**
 * Helper internal untuk menangani Fetch API
 */
async function apiRequest(endpoint, options = {}) {
  const { method = 'GET', body, headers = {} } = options;

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers,
    },
    // Next.js Cache: 'no-store' untuk data realtime (absensi)
    cache: 'no-store', 
  };

  if (body) config.body = JSON.stringify(body);

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);

    // Tangani HTTP Error (404, 500, 422 dll)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        message: errorData.message || 'Terjadi kesalahan server',
        errors: errorData.errors || null,
      };
    }

    // Jika response kosong (seperti DELETE)
    if (response.status === 204) return true;

    return await response.json();
  } catch (error) {
    console.error(`API Error [${method}] ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Objek Service untuk dipanggil di Komponen
 */
export const api = {
  // ENDPOINT GURU
  guru: {
    list: () => apiRequest('/gurus'),
    show: (id) => apiRequest(`/gurus/${id}`),
    store: (data) => apiRequest('/gurus', { method: 'POST', body: data }),
    update: (id, data) => apiRequest(`/gurus/${id}`, { method: 'PUT', body: data }),
    delete: (id) => apiRequest(`/gurus/${id}`, { method: 'DELETE' }),
    // Route khusus untuk absensi per guru
    getAbsensi: (id) => apiRequest(`/gurus/${id}/absensi`),
  },

  // ENDPOINT ABSENSI
  absensi: {
    list: () => apiRequest('/absensi'),
    show: (id) => apiRequest(`/absensi/${id}`),
    store: (data) => apiRequest('/absensi', { method: 'POST', body: data }),
    delete: (id) => apiRequest(`/absensi/${id}`, { method: 'DELETE' }),
  },
};
