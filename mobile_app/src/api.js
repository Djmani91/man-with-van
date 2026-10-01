import * as SecureStore from "expo-secure-store";
import { API } from "./config";

const TOKEN_KEY = "mwv_token";

let _token = null;

export async function loadToken() {
  _token = await SecureStore.getItemAsync(TOKEN_KEY);
  return _token;
}
export async function setToken(t) {
  _token = t;
  if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}
export function getToken() {
  return _token;
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  let payload;
  if (body != null) {
    if (isForm) {
      payload = body; // FormData — let fetch set the content-type boundary
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = (data && data.detail) || data || `Request failed (${res.status})`;
    const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: "POST", body }),
  put: (p, body) => request(p, { method: "PUT", body }),
  // Build an authenticated URL for protected files (<Image> cannot send headers).
  fileUrl: (path) => `${API}/files/${path}?auth=${encodeURIComponent(_token || "")}`,
  // Multipart upload for item photos -> returns { path }
  uploadPhoto: async (uri) => {
    const form = new FormData();
    const name = uri.split("/").pop() || "photo.jpg";
    const ext = (name.split(".").pop() || "jpg").toLowerCase();
    form.append("file", { uri, name, type: `image/${ext === "jpg" ? "jpeg" : ext}` });
    return request("/upload", { method: "POST", body: form, isForm: true });
  },
};
