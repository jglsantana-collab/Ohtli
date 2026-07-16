const TOKEN_KEY = 'ohtli_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch { /* respuesta sin cuerpo */ }
  if (!res.ok) {
    const message = data?.error || `Error ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/api/auth/me'),

  trips: () => request('/api/trips'),
  createTrip: (body) => request('/api/trips', { method: 'POST', body: JSON.stringify(body) }),
  trip: (id) => request(`/api/trips/${id}`),
  updateTrip: (id, body) => request(`/api/trips/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTrip: (id) => request(`/api/trips/${id}`, { method: 'DELETE' }),

  addMember: (tripId, email) =>
    request(`/api/trips/${tripId}/members`, { method: 'POST', body: JSON.stringify({ email }) }),
  removeMember: (tripId, userId) =>
    request(`/api/trips/${tripId}/members/${userId}`, { method: 'DELETE' }),

  addPlace: (tripId, body) =>
    request(`/api/trips/${tripId}/places`, { method: 'POST', body: JSON.stringify(body) }),
  updatePlace: (id, body) => request(`/api/places/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePlace: (id) => request(`/api/places/${id}`, { method: 'DELETE' }),

  addFlight: (tripId, body) =>
    request(`/api/trips/${tripId}/flights`, { method: 'POST', body: JSON.stringify(body) }),
  updateFlight: (id, body) => request(`/api/flights/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteFlight: (id) => request(`/api/flights/${id}`, { method: 'DELETE' }),
  lookupFlight: (flightNumber) =>
    request(`/api/flights/lookup?flight_number=${encodeURIComponent(flightNumber)}`),

  addDocument: (tripId, body) =>
    request(`/api/trips/${tripId}/documents`, { method: 'POST', body: JSON.stringify(body) }),
  updateDocument: (id, body) => request(`/api/documents/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDocument: (id) => request(`/api/documents/${id}`, { method: 'DELETE' }),

  tripWeather: (tripId) => request(`/api/trips/${tripId}/weather`),

  pushPublicKey: () => request('/api/push/public-key'),
  pushSubscribe: (subscription) => request('/api/push/subscribe', { method: 'POST', body: JSON.stringify(subscription) }),
  pushUnsubscribe: (endpoint) => request('/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  pushTest: () => request('/api/push/test', { method: 'POST' }),

  adminUsers: () => request('/api/admin/users'),
  adminSetPassword: (id, password) =>
    request(`/api/admin/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
  adminSetRole: (id, is_admin) =>
    request(`/api/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ is_admin }) }),
  adminDeleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' })
};
