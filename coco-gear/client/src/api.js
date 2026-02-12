const BASE = '/api';

function getToken() {
  return localStorage.getItem('slate_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('slate_token');
    localStorage.removeItem('slate_user');
    window.location.reload();
    throw new Error('Session expired');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ─── Auth ───
export const auth = {
  getUsers: () => request('/auth/users'),
  login: (userId, pin) => request('/auth/login', { method: 'POST', body: { userId, pin } }),
  signupInfo: () => request('/auth/signup-info'),
  signup: (data) => request('/auth/signup', { method: 'POST', body: data }),
  me: () => request('/auth/me'),
  updateProfile: (data) => request('/auth/me', { method: 'PUT', body: data }),
  changePassword: (newPassword, currentPassword) => request('/auth/me/password', { method: 'PUT', body: { newPassword, currentPassword } }),
};

// ─── Kits ───
export const kits = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/kits${q ? '?' + q : ''}`);
  },
  get: (id) => request(`/kits/${id}`),
  create: (data) => request('/kits', { method: 'POST', body: data }),
  update: (id, data) => request(`/kits/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/kits/${id}`, { method: 'DELETE' }),
  checkout: (data) => request('/kits/checkout', { method: 'POST', body: data }),
  return: (data) => request('/kits/return', { method: 'POST', body: data }),
  inspect: (data) => request('/kits/inspect', { method: 'POST', body: data }),
  updateSerials: (id, serials) => request(`/kits/${id}/serials`, { method: 'PUT', body: { serials } }),
  updateLocation: (id, locId) => request(`/kits/${id}/location`, { method: 'PUT', body: { locId } }),
  resolveDegraded: (id) => request(`/kits/${id}/resolve-degraded`, { method: 'POST' }),
};

// ─── Kit Types ───
export const types = {
  list: () => request('/types'),
  get: (id) => request(`/types/${id}`),
  create: (data) => request('/types', { method: 'POST', body: data }),
  update: (id, data) => request(`/types/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/types/${id}`, { method: 'DELETE' }),
};

// ─── Components ───
export const components = {
  list: () => request('/components'),
  create: (data) => request('/components', { method: 'POST', body: data }),
  update: (id, data) => request(`/components/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/components/${id}`, { method: 'DELETE' }),
};

// ─── Locations ───
export const locations = {
  list: () => request('/locations'),
  create: (data) => request('/locations', { method: 'POST', body: data }),
  update: (id, data) => request(`/locations/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/locations/${id}`, { method: 'DELETE' }),
};

// ─── Departments ───
export const departments = {
  list: () => request('/departments'),
  create: (data) => request('/departments', { method: 'POST', body: data }),
  update: (id, data) => request(`/departments/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/departments/${id}`, { method: 'DELETE' }),
};

// ─── Personnel ───
export const personnel = {
  list: () => request('/personnel'),
  get: (id) => request(`/personnel/${id}`),
  create: (data) => request('/personnel', { method: 'POST', body: data }),
  update: (id, data) => request(`/personnel/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/personnel/${id}`, { method: 'DELETE' }),
  import: (members) => request('/personnel/import', { method: 'POST', body: { members } }),
};

// ─── Consumables ───
export const consumables = {
  list: () => request('/consumables'),
  create: (data) => request('/consumables', { method: 'POST', body: data }),
  update: (id, data) => request(`/consumables/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/consumables/${id}`, { method: 'DELETE' }),
  adjust: (id, delta, reason) => request(`/consumables/${id}/adjust`, { method: 'POST', body: { delta, reason } }),
};

// ─── Standalone Assets ───
export const assets = {
  list: () => request('/assets'),
  create: (data) => request('/assets', { method: 'POST', body: data }),
  update: (id, data) => request(`/assets/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/assets/${id}`, { method: 'DELETE' }),
  checkout: (id, personId) => request(`/assets/${id}/checkout`, { method: 'POST', body: { personId } }),
  return: (id) => request(`/assets/${id}/return`, { method: 'POST' }),
};

// ─── Reservations ───
export const reservations = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reservations${q ? '?' + q : ''}`);
  },
  create: (data) => request('/reservations', { method: 'POST', body: data }),
  approve: (id) => request(`/reservations/${id}/approve`, { method: 'PUT' }),
  cancel: (id) => request(`/reservations/${id}/cancel`, { method: 'PUT' }),
  delete: (id) => request(`/reservations/${id}`, { method: 'DELETE' }),
};

// ─── Trips ───
export const trips = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/trips${q ? '?' + q : ''}`);
  },
  get: (id) => request(`/trips/${id}`),
  create: (data) => request('/trips', { method: 'POST', body: data }),
  update: (id, data) => request(`/trips/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/trips/${id}`, { method: 'DELETE' }),
  assignKits: (id, kitIds, autoReserve) => request(`/trips/${id}/kits`, { method: 'POST', body: { kitIds, autoReserve } }),
  removeKit: (tripId, kitId) => request(`/trips/${tripId}/kits/${kitId}`, { method: 'DELETE' }),
  addPersonnel: (tripId, data) => request(`/trips/${tripId}/personnel`, { method: 'POST', body: data }),
  addPersonnelBulk: (tripId, userIds, role) => request(`/trips/${tripId}/personnel/bulk`, { method: 'POST', body: { userIds, role } }),
  updatePersonnel: (tripId, personnelId, data) => request(`/trips/${tripId}/personnel/${personnelId}`, { method: 'PUT', body: data }),
  removePersonnel: (tripId, personnelId) => request(`/trips/${tripId}/personnel/${personnelId}`, { method: 'DELETE' }),
  addNote: (tripId, data) => request(`/trips/${tripId}/notes`, { method: 'POST', body: data }),
  deleteNote: (tripId, noteId) => request(`/trips/${tripId}/notes/${noteId}`, { method: 'DELETE' }),
  assignBoats: (tripId, boatIds, role, autoReserve) => request(`/trips/${tripId}/boats`, { method: 'POST', body: { boatIds, role, autoReserve } }),
  updateBoat: (tripId, tripBoatId, data) => request(`/trips/${tripId}/boats/${tripBoatId}`, { method: 'PUT', body: data }),
  removeBoat: (tripId, tripBoatId) => request(`/trips/${tripId}/boats/${tripBoatId}`, { method: 'DELETE' }),
  manifest: (id) => request(`/trips/${id}/manifest`),
  readiness: (id) => request(`/trips/${id}/readiness`),
};

// ─── Trip Comms ───
export const comms = {
  list: (tripId) => request(`/trips/${tripId}/comms`),
  create: (tripId, data) => request(`/trips/${tripId}/comms`, { method: 'POST', body: data }),
  update: (tripId, id, data) => request(`/trips/${tripId}/comms/${id}`, { method: 'PUT', body: data }),
  delete: (tripId, id) => request(`/trips/${tripId}/comms/${id}`, { method: 'DELETE' }),
  reorder: (tripId, entryIds) => request(`/trips/${tripId}/comms/reorder`, { method: 'POST', body: { entryIds } }),
};

// ─── Packing Templates ───
export const packingTemplates = {
  list: (params = {}) => { const q = new URLSearchParams(params).toString(); return request(`/packing-templates${q ? '?' + q : ''}`); },
  create: (data) => request('/packing-templates', { method: 'POST', body: data }),
  update: (id, data) => request(`/packing-templates/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/packing-templates/${id}`, { method: 'DELETE' }),
};

// ─── Trip Packing ───
export const packing = {
  get: (tripId) => request(`/trips/${tripId}/packing`),
  addItem: (tripId, data) => request(`/trips/${tripId}/packing/items`, { method: 'POST', body: data }),
  updateItem: (tripId, itemId, data) => request(`/trips/${tripId}/packing/items/${itemId}`, { method: 'PUT', body: data }),
  deleteItem: (tripId, itemId) => request(`/trips/${tripId}/packing/items/${itemId}`, { method: 'DELETE' }),
  bulkAddItems: (tripId, items) => request(`/trips/${tripId}/packing/items/bulk`, { method: 'POST', body: { items } }),
  check: (tripId, itemKey, checked) => request(`/trips/${tripId}/packing/check`, { method: 'PUT', body: { itemKey, checked } }),
  myChecks: (tripId) => request(`/trips/${tripId}/packing/my-checks`),
};

// ─── Tasks ───
export const tasks = {
  list: (tripId) => request(`/trips/${tripId}/tasks`),
  create: (tripId, data) => request(`/trips/${tripId}/tasks`, { method: 'POST', body: data }),
  update: (tripId, taskId, data) => request(`/trips/${tripId}/tasks/${taskId}`, { method: 'PUT', body: data }),
  delete: (tripId, taskId) => request(`/trips/${tripId}/tasks/${taskId}`, { method: 'DELETE' }),
  reorder: (tripId, taskIds) => request(`/trips/${tripId}/tasks/reorder`, { method: 'POST', body: { taskIds } }),
  fromTemplate: (tripId, templateId) => request(`/trips/${tripId}/tasks/from-template`, { method: 'POST', body: { templateId } }),
};

// ─── Task Templates ───
export const taskTemplates = {
  list: () => request('/task-templates'),
  create: (data) => request('/task-templates', { method: 'POST', body: data }),
  update: (id, data) => request(`/task-templates/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/task-templates/${id}`, { method: 'DELETE' }),
};

// ─── Boats ───
export const boats = {
  list: () => request('/boats'),
  create: (data) => request('/boats', { method: 'POST', body: data }),
  update: (id, data) => request(`/boats/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/boats/${id}`, { method: 'DELETE' }),
};

// ─── Maintenance ───
export const maintenance = {
  list: () => request('/maintenance'),
  send: (data) => request('/maintenance/send', { method: 'POST', body: data }),
  return: (kitId, notes) => request(`/maintenance/${kitId}/return`, { method: 'POST', body: { notes } }),
};

// ─── Audit ───
export const audit = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/audit${q ? '?' + q : ''}`);
  },
  stats: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/audit/stats${q ? '?' + q : ''}`);
  },
};

// ─── Settings ───
export const settings = {
  get: () => request('/settings'),
  update: (data) => request('/settings', { method: 'PUT', body: data }),
};

// ─── Reports ───
export const reports = {
  fleet: () => request('/reports/fleet'),
  checkouts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reports/checkouts${q ? '?' + q : ''}`);
  },
  inspections: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reports/inspections${q ? '?' + q : ''}`);
  },
  personnel: () => request('/reports/personnel'),
  components: () => request('/reports/components'),
  departments: () => request('/reports/departments'),
  custody: (kitId) => request(`/reports/custody/${kitId}`),
};

// ─── File Upload ───
export const upload = {
  photos: async (files) => {
    const formData = new FormData();
    for (const file of files) formData.append('photos', file);
    return request('/upload', { method: 'POST', body: formData });
  },
};

// ─── Health ───
export const health = () => request('/health');

export default {
  auth, kits, types, components, locations, departments,
  personnel, consumables, assets, reservations, trips, tasks, taskTemplates,
  packingTemplates, packing, comms, boats, maintenance,
  audit, settings, reports, upload, health,
};
