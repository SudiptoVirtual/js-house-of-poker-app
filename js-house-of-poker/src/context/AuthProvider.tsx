import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { fetchCurrentUser, type AuthUser } from '../services/api/auth';
import { clearAuthSession, getAuthSession, saveAuthSession } from '../services/storage/sessionStorage';

type AuthContextValue = {
  currentUser: AuthUser | null;
  isRestoringSession: boolean;
  refreshCurrentUser: (tokenOverride?: string | null) => Promise<AuthUser | null>;
  setAuthenticatedSession: (session: { token: string; user: AuthUser }) => Promise<void>;
  signOut: () => Promise<void>;
  token: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type SessionInput = {
  token: string;
  user: AuthUser;
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  const refreshCurrentUser = useCallback(
    async (tokenOverride?: string | null) => {
      const authToken = tokenOverride ?? token;

      if (!authToken) {
        return null;
      }

      const freshUser = await fetchCurrentUser(authToken);
      setCurrentUser(freshUser);
      await saveAuthSession({ token: authToken, user: freshUser });

      return freshUser;
    },
    [token],
  );

  const setAuthenticatedSession = useCallback(
    async ({ token: nextToken, user }: SessionInput) => {
      setToken(nextToken);
      setCurrentUser(user);
      await saveAuthSession({ token: nextToken, user });

      try {
        await refreshCurrentUser(nextToken);
      } catch (error) {
        console.warn('Unable to refresh the authenticated user after sign in.', error);
      }
    },
    [refreshCurrentUser],
  );

  const signOut = useCallback(async () => {
    setToken(null);
    setCurrentUser(null);
    await clearAuthSession();
  }, []);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const session = await getAuthSession();

        if (!isMounted) {
          return;
        }

        if (!session?.token) {
          return;
        }

        setToken(session.token);

        if (session.user) {
          setCurrentUser(session.user);
        }

        try {
          const freshUser = await fetchCurrentUser(session.token);

          if (isMounted) {
            setCurrentUser(freshUser);
            await saveAuthSession({ token: session.token, user: freshUser });
          }
        } catch (error) {
          console.warn('Unable to restore the authenticated user session.', error);
        }
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      isRestoringSession,
      refreshCurrentUser,
      setAuthenticatedSession,
      signOut,
      token,
    }),
    [currentUser, isRestoringSession, refreshCurrentUser, setAuthenticatedSession, signOut, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
