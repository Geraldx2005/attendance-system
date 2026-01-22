const API_BASE = "http://127.0.0.1:47832";

export function apiFetch(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": window.__INTERNAL_TOKEN__,
      ...(options.headers || {}),
    },
  });
}

