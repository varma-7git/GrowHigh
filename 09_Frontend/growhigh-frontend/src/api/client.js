import axios from "axios";

export const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api/v1";

const store = {
  get access() { return localStorage.getItem("gh_access"); },
  get refresh() { return localStorage.getItem("gh_refresh"); },
  set(access, refresh) {
    if (access) localStorage.setItem("gh_access", access);
    if (refresh) localStorage.setItem("gh_refresh", refresh);
  },
  clear() {
    ["gh_access", "gh_refresh", "gh_user"].forEach((k) => localStorage.removeItem(k));
  },
};
export const tokenStore = store;

const api = axios.create({ baseURL: API_URL, headers: { "Content-Type": "application/json" } });

api.interceptors.request.use((config) => {
  if (store.access && !config.skipAuth) config.headers.Authorization = `Bearer ${store.access}`;
  return config;
});

// One silent refresh when the access token has expired, then retry the request once.
let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.skipAuth && store.refresh) {
      original._retry = true;
      try {
        refreshing = refreshing || axios.post(`${API_URL}/auth/refresh/`, { refresh: store.refresh });
        const { data } = await refreshing;
        refreshing = null;
        store.set(data.access, data.refresh);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        store.clear();
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

/** Turns a backend error {detail, errors:{field:[msg]}} into { message, fields }. */
export function parseError(error) {
  const res = error.response;
  if (!res) return { message: "Cannot reach the server. Is the backend running?", fields: {} };
  const data = res.data || {};
  const fields = {};
  const source = data.errors || (typeof data === "object" && !data.detail ? data : {});
  Object.entries(source).forEach(([k, v]) => {
    fields[k] = Array.isArray(v) ? v.join(" ") : String(v);
  });
  let message = data.detail || "";
  if (res.status === 429) message = "Too many attempts. Please wait a little and try again.";
  if (!message && Object.keys(fields).length) message = "Please fix the highlighted fields.";
  return { message: message || "Something went wrong. Please try again.", fields };
}

export default api;
