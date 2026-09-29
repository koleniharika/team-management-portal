// Talks to the Cloudflare Worker. The JWT lives in localStorage and rides along
// on every call; the API surface mirrors the old row helpers so pages read the same.
const BASE = String(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const TOKEN_KEY = 'erp.token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode: the session just won't survive a refresh */ }
};

const qs = (params) => {
  const entries = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
};

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  list: (resource, params) => request(`/${resource}${qs(params)}`),
  get: (resource, id) => request(`/${resource}/${id}`),
  create: (resource, data) => request(`/${resource}`, { method: 'POST', body: data }),
  update: (resource, id, data) => request(`/${resource}/${id}`, { method: 'PATCH', body: data }),
  remove: (resource, id) => request(`/${resource}/${id}`, { method: 'DELETE' }),

  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
};

/** Confirm + delete. The backend removes the task's comments with it. */
export const confirmDeleteTask = async (task) => {
  if (!window.confirm("Delete this task? This can't be undone.")) return false;
  await api.remove('tasks', task.id);
  return true;
};
