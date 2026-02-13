const BASE = '/api';

function getToken() {
  return localStorage.getItem('slate_token');
}

function setToken(token) {
  localStorage.setItem('slate_token', token);
}

// ─── Token refresh state ───
// Prevents multiple simultaneous refresh attempts and queues waiting requests
let refreshPromise = null;
let sessionExpiredHandled = false;

// Event target for session events that auth.jsx can listen to
export const sessionEvents = new EventTarget();

/**
 * Attempt to refresh the JWT token silently.
 * Returns the new token on success, or null on failure.
 */
async function refreshToken() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    if (!data?.token) return null;

    setToken(data.token);
    localStorage.setItem('slate_user', JSON.stringify(data.user));
    sessionEvents.dispatchEvent(new CustomEvent('token-refreshed', { detail: data }));
    return data.token;
  } catch {
    return null;
  }
}

/**
 * Coordinate token refresh across concurrent requests.
 * Only one refresh runs at a time; others wait for the same result.
 */
async function coordinatedRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = refreshToken().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * Handle unrecoverable session expiration (only fires once to avoid loops).
 */
function handleSessionExpired() {
  if (sessionExpiredHandled) return;
  sessionExpiredHandled = true;

  localStorage.removeItem('slate_token');
  localStorage.removeItem('slate_user');
  sessionEvents.dispatchEvent(new CustomEvent('session-expired'));
}

// Reset the flag when a new login happens
sessionEvents.addEventListener('login', () => {
  sessionExpiredHandled = false;
});

/**
 * Parse JWT expiry time from the token payload.
 * Returns the expiry time in milliseconds, or 0 if unparseable.
 */
export function getTokenExpiry(token) {
  if (!token) return 0;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
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

  // On 401, attempt a silent token refresh and retry the original request once
  if (res.status === 401) {
    // Don't try to refresh the refresh endpoint itself
    if (path === '/auth/refresh') {
      handleSessionExpired();
      throw new Error('Session expired');
    }

    const newToken = await coordinatedRefresh();
    if (newToken) {
      // Retry the original request with the new token
      const retryHeaders = { ...options.headers };
      retryHeaders['Authorization'] = `Bearer ${newToken}`;
      if (options.body && typeof options.body === 'string' && !options.headers?.['Content-Type']) {
        retryHeaders['Content-Type'] = 'application/json';
      }
      const retryRes = await fetch(`${BASE}${path}`, { ...options, headers: retryHeaders });
      if (retryRes.status === 401) {
        // Refresh succeeded but still getting 401 — session is truly expired
        handleSessionExpired();
        throw new Error('Session expired');
      }
      const retryData = await retryRes.json().catch(() => ({}));
      if (!retryRes.ok) throw new Error(retryData.error || `Request failed (${retryRes.status})`);
      return retryData;
    }

    // Refresh failed — session is expired
    handleSessionExpired();
    throw new Error('Session expired');
  }

  // On 403, dispatch event so auth context can refresh user permissions
  if (res.status === 403) {
    sessionEvents.dispatchEvent(new CustomEvent('permission-changed'));
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
  signupStatus: (email) => request(`/auth/signup-status/${encodeURIComponent(email)}`),
  me: () => request('/auth/me'),
  refresh: () => coordinatedRefresh(),
  updateProfile: (data) => request('/auth/me', { method: 'PUT', body: data }),
  changePassword: (newPassword, currentPassword) => request('/auth/me/password', { method: 'PUT', body: { newPassword, currentPassword } }),
};

// ─── User Approval ───
export const approval = {
  list: (status = 'pending') => request(`/approval?status=${status}`),
  count: () => request('/approval/count'),
  approve: (id, data = {}) => request(`/approval/${id}/approve`, { method: 'PUT', body: data }),
  deny: (id, data = {}) => request(`/approval/${id}/deny`, { method: 'PUT', body: data }),
  revoke: (id, data = {}) => request(`/approval/${id}/revoke`, { method: 'PUT', body: data }),
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
  accessRequests: () => request('/kits/access-requests'),
  requestAccess: (data) => request('/kits/request-access', { method: 'POST', body: data }),
  approveAccess: (id) => request(`/kits/access-requests/${id}/approve`, { method: 'PUT' }),
  denyAccess: (id) => request(`/kits/access-requests/${id}/deny`, { method: 'PUT' }),
  availability: (id, start, end) => request(`/kits/${id}/availability?start=${start}&end=${end}`),
  // Checkout requests (department approval workflow)
  checkoutRequests: () => request('/kits/checkout-requests'),
  myCheckoutRequests: () => request('/kits/checkout-requests/mine'),
  submitCheckoutRequest: (data) => request('/kits/checkout-requests', { method: 'POST', body: data }),
  approveCheckoutRequest: (id, data) => request(`/kits/checkout-requests/${id}/approve`, { method: 'PUT', body: data || {} }),
  denyCheckoutRequest: (id, data) => request(`/kits/checkout-requests/${id}/deny`, { method: 'PUT', body: data || {} }),
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
  availability: (id, start, end) => request(`/personnel/${id}/availability?start=${start}&end=${end}`),
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
  aar: (id) => request(`/trips/${id}/aar`),
  clone: (id, data) => request(`/trips/${id}/clone`, { method: 'POST', body: data }),
  conflicts: (id) => request(`/trips/${id}/conflicts`),
  phases: {
    list: (tripId) => request(`/trips/${tripId}/phases`),
    create: (tripId, data) => request(`/trips/${tripId}/phases`, { method: 'POST', body: data }),
    update: (tripId, id, data) => request(`/trips/${tripId}/phases/${id}`, { method: 'PUT', body: data }),
    delete: (tripId, id) => request(`/trips/${tripId}/phases/${id}`, { method: 'DELETE' }),
    reorder: (tripId, phaseIds) => request(`/trips/${tripId}/phases/reorder`, { method: 'POST', body: { phaseIds } }),
  },
  milestones: {
    list: (tripId) => request(`/trips/${tripId}/milestones`),
    create: (tripId, data) => request(`/trips/${tripId}/milestones`, { method: 'POST', body: data }),
    update: (tripId, id, data) => request(`/trips/${tripId}/milestones/${id}`, { method: 'PUT', body: data }),
    delete: (tripId, id) => request(`/trips/${tripId}/milestones/${id}`, { method: 'DELETE' }),
  },
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

// ─── Trip Templates ───
export const tripTemplates = {
  list: () => request('/trip-templates'),
  get: (id) => request(`/trip-templates/${id}`),
  create: (data) => request('/trip-templates', { method: 'POST', body: data }),
  fromTrip: (tripId, data) => request(`/trip-templates/from-trip/${tripId}`, { method: 'POST', body: data }),
  update: (id, data) => request(`/trip-templates/${id}`, { method: 'PUT', body: data }),
  delete: (id) => request(`/trip-templates/${id}`, { method: 'DELETE' }),
  apply: (id, data) => request(`/trip-templates/${id}/apply`, { method: 'POST', body: data }),
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

// ─── Dashboard ───
export const dashboard = {
  getConfig: () => request('/auth/me/dashboard'),
  saveConfig: (config) => request('/auth/me/dashboard', { method: 'PUT', body: config }),
};

// ─── Health ───
export const health = () => request('/health');

export default {
  auth, approval, kits, types, components, locations, departments,
  personnel, consumables, assets, reservations, trips, tasks, taskTemplates,
  tripTemplates, packingTemplates, packing, comms, boats, maintenance,
  audit, settings, reports, upload, dashboard, health,
};
