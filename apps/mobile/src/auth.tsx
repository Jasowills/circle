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
  /** True when the account was just created and still needs a display name. */
  setupRequired: boolean;
  signIn: (accessToken: string, refreshToken: string, isNew: boolean) => Promise<void>;
  reloadUser: () => Promise<void>;
  completeSetup: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  ready: false,
  setupRequired: false,
  signIn: async () => {},
  reloadUser: async () => {},
  completeSetup: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);

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

  const signIn = useCallback(async (accessToken: string, refreshToken: string, isNew: boolean) => {
    await saveTokens(accessToken, refreshToken);
    const me = await api.get<User>('/me');
    setUser(me);
    setSetupRequired(isNew);
  }, []);

  const completeSetup = useCallback(() => setSetupRequired(false), []);

  const reloadUser = useCallback(async () => {
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
    setSetupRequired(false);
  }, []);

  return <Ctx.Provider value={{ user, ready, setupRequired, signIn, reloadUser, completeSetup, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
