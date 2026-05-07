const TOKEN_KEY = "das_token";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (response.status === 401 || response.status === 403) {
    clearToken();
    window.dispatchEvent(new Event("das:auth-expired"));
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function login(username, password) {
  return api("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

export function getAnalytics() {
  return api("/api/das/analytics");
}

export async function getEntities() {
  const data = await api("/api/das/entities");
  return data.items || [];
}

export function createEntity(payload) {
  return api("/api/das/entities", { method: "POST", body: JSON.stringify(payload) });
}

export function updateEntity(id, payload) {
  return api(`/api/das/entities/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deleteEntity(id) {
  return api(`/api/das/entities/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getProfile() {
  return api("/api/profile");
}

export function getHealth() {
  return api("/health");
}
