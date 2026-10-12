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

export const api = {
  signUp: (fields) => request('/auth/signup', { method: 'POST', body: fields }),
  login: (fields) => request('/auth/login', { method: 'POST', body: fields }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
};
