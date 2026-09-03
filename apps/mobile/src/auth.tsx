import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearTokens, getAccessToken, getRefreshToken, saveTokens } from './api';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

interface AuthCtx {
  user: User | null;
  ready: boolean;
  signIn: (accessToken: string, refreshToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  ready: false,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getAccessToken()
      .then((t) => {
        if (!t) return null;
        return api.get<User>('/me').catch(() => null);
      })
      .then((me) => {
        setUser(me);
        setReady(true);
      });
  }, []);

  const signIn = useCallback(async (accessToken: string, refreshToken: string) => {
    await saveTokens(accessToken, refreshToken);
    const me = await api.get<User>('/me');
    setUser(me);
  }, []);

  const signOut = useCallback(async () => {
    try {
      const rt = await getRefreshToken();
      if (rt) await api.post('/auth/logout', { refreshToken: rt });
    } catch {
      /* ignore */
    }
    await clearTokens();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, ready, signIn, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
