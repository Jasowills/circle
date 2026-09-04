import * as SecureStore from 'expo-secure-store';

/**
 * Same API as web, but tokens live in expo-secure-store instead of a cookie
 * jar. The refresh token goes in the request body.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000';

const ACCESS_KEY = 'circle.accessToken';
const REFRESH_KEY = 'circle.refreshToken';

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}
export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}
export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
}
export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401 && retry && token) {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      const r = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (r.ok) {
        const pair = (await r.json()) as { accessToken: string; refreshToken: string };
        await saveTokens(pair.accessToken, pair.refreshToken);
        return request<T>(path, init, false);
      }
    }
    await clearTokens();
    throw new Error('Session expired. Please sign in again');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  postPublic: async <T>(p: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${API_URL}${p}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error((b as { message?: string }).message ?? `Request failed (${res.status})`);
    }
    return (await res.json()) as T;
  },
};

export interface CircleSummary {
  id: string;
  name: string;
  goalAmount: number;
  currency: string;
  status: string;
  balance: number;
  progress: number;
  memberCount: number;
  activeMemberCount: number;
}

export interface CircleDetail extends CircleSummary {
  myBalance: number;
  myMembership: { role: string; status: string };
  members: {
    userId: string;
    user: { id: string; name: string; email: string; avatarUrl: string | null };
    role: string;
    status: string;
    balance: number;
  }[];
}
