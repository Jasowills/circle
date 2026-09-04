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
  const res = await timedFetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  // A wiped access token must not brick a session while a valid refresh
  // token still exists: always attempt refresh on a 401.
  if (res.status === 401 && retry) {
    try {
      await silentRefresh();
      return request<T>(path, init, false);
    } catch {
      await clearTokens();
      throw new Error('Session expired. Please sign in again');
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

let inflight: Promise<void> | null = null;

/** One shared refresh: parallel 401s must not stampede rotation. */
async function silentRefresh(): Promise<void> {
  if (!inflight) {
    inflight = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new Error('no refresh token');
      const r = await timedFetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!r.ok) throw new Error('refresh failed');
      const pair = (await r.json()) as { accessToken: string; refreshToken: string };
      await saveTokens(pair.accessToken, pair.refreshToken);
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** fetch that gives up after TIMEOUT_MS instead of hanging forever. */
async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    throw new Error(`Could not reach the API at ${API_URL} (${e instanceof Error ? e.message : 'network error'})`);
  } finally {
    clearTimeout(t);
  }
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  postPublic: async <T>(p: string, body?: unknown): Promise<T> => {
    const res = await timedFetch(`${API_URL}${p}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      const msg = (b as { message?: string }).message ?? `Request failed (${res.status})`;
      console.log(`[Circle] POST ${p} -> ${res.status}: ${msg}`);
      throw new Error(msg);
    }
    return (await res.json()) as T;
  },
};

export interface Person {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface PersonProfile {
  user: Person;
  isSelf: boolean;
  sharedCircles: { id: string; name: string; status: string }[];
  inviteTargets: { id: string; name: string; status: string }[];
}

export interface LedgerEntry {
  id: string;
  userId: string;
  user: { name: string };
  amount: string;
  type: string;
  createdAt: string;
}

export interface WalletTx {
  id: string;
  amount: string;
  type: string;
  relatedCircleId: string | null;
  relatedCycleId: string | null;
  createdAt: string;
}

export interface WalletOverview {
  balance: number;
  data: WalletTx[];
  page: number;
  limit: number;
  total: number;
}

export interface Cycle {
  id: string;
  cycleNumber: number;
  recipient: { id: string; name: string };
  startsAt: string;
  endsAt: string;
  targetPot: number;
  collected: number;
  status: string;
  payoutClaimedAt: string | null;
}

export interface CurrentCycle {
  id: string;
  cycleNumber: number;
  totalCycles: number;
  recipient: { id: string; name: string };
  targetPot: number;
  collected: number;
  endsAt: string;
}

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
  contributionAmount?: number | null;
  targetMembers?: number | null;
  currentCycle?: CurrentCycle | null;
}

export interface CircleDetail extends CircleSummary {
  myBalance: number;
  myMembership: { role: string; status: string };
  myAutopilot: { contribute: boolean; collect: boolean };
  myNextContributionAt: string | null;
  contributionsPerWeek?: number | null;
  rotationMode: string;
  cycleLengthDays: number;
  createdAt: string;
  members: {
    userId: string;
    user: { id: string; name: string; email: string; avatarUrl: string | null };
    role: string;
    status: string;
    balance: number;
  }[];
}
