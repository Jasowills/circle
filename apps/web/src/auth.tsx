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
  signIn: (accessToken: string, refreshToken?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, token: null, signIn: async () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTok] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    api
      .get<User>('/me')
      .then(setUser)
      .catch(() => {
        setToken(null);
        setTok(null);
      });
  }, [token]);

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

  return <Ctx.Provider value={{ user, token, signIn, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const googleLoginUrl = `${API_URL}/auth/google`;
