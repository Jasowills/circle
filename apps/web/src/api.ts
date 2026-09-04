export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'circle.accessToken';

// Auth trace: run `localStorage.setItem('circle.debugAuth','1')` in the
// console, reload, and watch each 401/refresh/redirect decision play out.
function trace(...args: unknown[]) {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('circle.debugAuth') === '1') {
    console.log('[auth]', ...args);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}), ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    credentials: 'include',
  });
  // A failed refresh used to wipe the access token, which permanently bricked
  // the session: later reloads skipped refresh (no token) even with a valid
  // cookie sitting right there. So: always attempt the cookie refresh on a
  // 401. No cookie/token just 401s again and lands on /login as before.
  if (res.status === 401 && retry) {
    trace(path, '-> 401, hadToken=', !!getToken());
    try {
      await silentRefresh();
      trace(path, '-> recovered via refresh');
      return request<T>(path, init, false);
    } catch (e) {
      trace(path, '-> refresh failed, redirecting to /login:', e instanceof Error ? e.message : e);
      setToken(null);
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

let inflight: Promise<string> | null = null;

function silentRefresh(): Promise<string> {
  if (!inflight) {
    trace('refresh start (leader)');
    inflight = (async () => {
      const r = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error(`refresh failed (${r.status})`);
      const { accessToken } = (await r.json()) as { accessToken: string };
      setToken(accessToken);
      trace('refresh ok');
      return accessToken;
    })().finally(() => {
      inflight = null;
    });
  } else {
    trace('refresh shared (follower)');
  }
  return inflight;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
};

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
  currentCycle?: {
    id: string;
    cycleNumber: number;
    totalCycles: number;
    recipient: { id: string; name: string };
    targetPot: number;
    collected: number;
    endsAt: string;
  } | null;
}

export interface CircleDetail extends CircleSummary {
  myBalance: number;
  myMembership: { role: string; status: string };
  myAutopilot: { contribute: boolean; collect: boolean };
  myNextContributionAt: string | null;
  contributionAmount?: number | null;
  targetMembers?: number | null;
  contributionsPerWeek?: number | null;
  cycleLengthDays: number;
  createdAt: string;
  currentCycle?: {
    id: string;
    cycleNumber: number;
    totalCycles: number;
    recipient: { id: string; name: string };
    targetPot: number;
    collected: number;
    endsAt: string;
  } | null;
  members: {
    userId: string;
    user: { id: string; name: string; email: string; avatarUrl: string | null };
    role: string;
    status: string;
    balance: number;
  }[];
}

export interface LedgerPage {
  data: { id: string; userId: string; user: { name: string }; amount: string; type: string; createdAt: string }[];
  page: number;
  total: number;
}
