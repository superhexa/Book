import { storage } from "@/src/utils/storage";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "") + "/api";

const ACCESS_KEY = "tb_access";
const REFRESH_KEY = "tb_refresh";

export async function setTokens(access: string, refresh: string) {
  await storage.secureSet(ACCESS_KEY, access);
  await storage.secureSet(REFRESH_KEY, refresh);
}
export async function clearTokens() {
  await storage.secureRemove(ACCESS_KEY);
  await storage.secureRemove(REFRESH_KEY);
}
export async function getAccess() {
  return storage.secureGet(ACCESS_KEY, "");
}
export async function getRefresh() {
  return storage.secureGet(REFRESH_KEY, "");
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refresh = await getRefresh();
  if (!refresh) return null;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: refresh }),
  });
  if (!res.ok) {
    await clearTokens();
    return null;
  }
  const data = await res.json();
  await setTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

async function request<T = any>(
  method: string,
  path: string,
  body?: any,
  opts: { auth?: boolean; retry?: boolean } = {},
): Promise<T> {
  const { auth = true, retry = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getAccess();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && retry) {
    if (!refreshing) refreshing = doRefresh();
    const newToken = await refreshing;
    refreshing = null;
    if (newToken) return request<T>(method, path, body, { auth, retry: false });
  }

  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || "Something went wrong";
    throw new ApiError(typeof msg === "string" ? msg : "Request failed", res.status);
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string, auth = true) => request<T>("GET", p, undefined, { auth }),
  post: <T = any>(p: string, body?: any, auth = true) => request<T>("POST", p, body, { auth }),
  patch: <T = any>(p: string, body?: any) => request<T>("PATCH", p, body),
  put: <T = any>(p: string, body?: any) => request<T>("PUT", p, body),
  del: <T = any>(p: string) => request<T>("DELETE", p),
};

export const fileUrl = (path?: string | null) => {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${BASE}/files/${path}`;
};

export { BASE as API_BASE };
