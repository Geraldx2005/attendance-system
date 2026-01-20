const API_BASE = "http://127.0.0.1:47832";

export function apiFetch(path) {
  return fetch(`${API_BASE}${path}`, {
    headers: {
      "x-internal-token": window.__INTERNAL_TOKEN__,
    },
  });
}
