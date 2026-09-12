'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { UserRole } from '@/types/database';

export interface User {
  id: string;
  role: UserRole;
  org_id: string | null;
  region_id: string;
  district: string | null;
  language: string;
  full_name: string | null;
}

export interface Organisation {
  id: string;
  name: string;
  type: string;
}

interface AuthContextType {
  user: User | null;
  organisation: Organisation | null;
  /** The signed-in user's role, or null when nobody is signed in. */
  role: UserRole | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  demoSignIn: (role: UserRole) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  organisation: null,
  role: null,
  loading: true,
  isAuthenticated: false,
  signIn: async () => {
    throw new Error('AuthProvider is missing');
  },
  demoSignIn: async () => {
    throw new Error('AuthProvider is missing');
  },
  signOut: async () => {},
  refresh: async () => {},
});

/** The console each role lands on after signing in. */
export const ROLE_HOME: Record<UserRole, string> = {
  citizen: '/my-reports',
  volunteer: '/verify',
  verifier: '/verify',
  university: '/college',
  industry: '/needs',
  coordinator: '/queue',
  admin: '/admin',
};

async function post(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      json?.error?.message || json?.error || 'That did not work. Please try again.';
    throw new Error(typeof message === 'string' ? message : 'Request failed');
  }
  return json?.data ?? json;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/login', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      const data = json?.data ?? json;
      if (data?.user) {
        setUser(data.user as User);
        setOrganisation((data.organisation as Organisation) ?? null);
      } else {
        setUser(null);
        setOrganisation(null);
      }
    } catch {
      // Offline or the backend is unreachable. Stay signed out rather than
      // guessing a role - guessing is how an unauthenticated visitor ended up
      // being treated as a district coordinator.
      setUser(null);
      setOrganisation(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refresh();
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await post('/api/auth/login', { email, password });
      setUser(data.user as User);
      setOrganisation((data.organisation as Organisation) ?? null);
      return data.user as User;
    } finally {
      setLoading(false);
    }
  }, []);

  const demoSignIn = useCallback(async (role: UserRole) => {
    setLoading(true);
    try {
      const data = await post('/api/auth/demo-login', { role });
      setUser(data.user as User);
      // demo-login does not resolve the organisation; pick it up on refresh.
      await refresh();
      return data.user as User;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await post('/api/auth/logout');
    } catch {
      // Clearing local state matters more than the round trip succeeding.
    }
    setUser(null);
    setOrganisation(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        organisation,
        role: user?.role ?? null,
        loading,
        isAuthenticated: Boolean(user),
        signIn,
        demoSignIn,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
