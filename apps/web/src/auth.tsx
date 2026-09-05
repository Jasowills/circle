import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_URL, api, getToken, setToken } from './api';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  offline: boolean;
  ready: boolean;
  signIn: (accessToken: string, refreshToken?: string) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, token: null, offline: false, ready: false, signIn: async () => {}, signOut: async () => {}, retry: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTok] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<User | null>(null);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Until the first session check settles, nobody may redirect. Otherwise a
  // reload bounces to /login on first paint and strands valid sessions there.
  const [ready, setReady] = useState(() => !getToken());

  useEffect(() => {
    if (!token) {
      setUser(null);
      setReady(true);
      return;
    }
    setOffline(false);
    api
      .get<User>('/me')
      .then((me) => {
        setUser(me);
        setReady(true);
      })
      .catch((e: Error) => {
        if (e.message === 'Session expired') {
          setToken(null);
          setTok(null);
          setReady(true);
        } else {
          // Network failure, not logout. Keep the token; offer a retry.
          setOffline(true);
        }
      });
  }, [token, attempt]);

  const signIn = useCallback(async (accessToken: string) => {
    setToken(accessToken);
    setTok(accessToken);
    const me = await api.get<User>('/me');
    setUser(me);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    setToken(null);
    setTok(null);
    setUser(null);
  }, []);

  // Re-run the session check (used by the offline screen's Retry).
  const retry = useCallback(() => {
    setOffline(false);
    setAttempt((a) => a + 1);
  }, []);

  return <Ctx.Provider value={{ user, token, offline, ready, signIn, signOut, retry }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const googleLoginUrl = `${API_URL}/auth/google`;
