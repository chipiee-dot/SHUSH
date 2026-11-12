export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response (for example a proxy error page) - handled below.
  }

  if (!response.ok) {
    throw new ApiError(data?.message || 'Something went wrong. Please try again.', response.status);
  }
  return data ?? {};
}

// Builds ?a=1&b=2, leaving out empty values.
function query(params = {}) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ).toString();
  return search ? `?${search}` : '';
}

export const api = {
  // Auth
  signUp: (fields) => request('/auth/signup', { method: 'POST', body: fields }),
  login: (fields) => request('/auth/login', { method: 'POST', body: fields }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // Faculty console
  dashboard: () => request('/dashboard'),
  layout: () => request('/layout'),
  notifications: () => request('/notifications'),
  startMaintenance: (fields) => request('/maintenance', { method: 'POST', body: fields }),
  endMaintenance: (id) => request(`/maintenance/${encodeURIComponent(id)}/end`, { method: 'POST' }),
  rewards: (period) => request(`/rewards${query({ period })}`),
  history: (params) => request(`/history${query(params)}`),

  // Students
  studentSignUp: (fields) => request('/student/signup', { method: 'POST', body: fields }),
  studentLookup: (studentNo) => request('/student/lookup', { method: 'POST', body: { studentNo } }),
  studentLogin: (studentNo) => request('/student/login', { method: 'POST', body: { studentNo } }),
  studentLogout: () => request('/student/logout', { method: 'POST' }),
  studentMe: () => request('/student/me'),
  studentTables: (groupSize) => request(`/student/tables${query({ groupSize })}`),
  studentStartSession: (tableNo, groupSize) =>
    request('/student/session', { method: 'POST', body: { tableNo, groupSize } }),
  studentEndSession: () => request('/student/session/end', { method: 'POST' }),

  // Settings (administrators only)
  adminTables: () => request('/settings/tables'),
  addTable: (fields) => request('/settings/tables', { method: 'POST', body: fields }),
  setTableSeats: (tableNo, seats) =>
    request(`/settings/tables/${encodeURIComponent(tableNo)}`, { method: 'PUT', body: { seats } }),
  clearSampleData: () => request('/settings/sample-data/clear', { method: 'POST' }),
  devices: () => request('/settings/devices'),
  saveThreshold: (deviceCode, threshold) =>
    request(`/settings/devices/${encodeURIComponent(deviceCode)}`, { method: 'PUT', body: { threshold } }),
};
