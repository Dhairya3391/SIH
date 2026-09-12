"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import type { Organisation, User, UserRole } from "@/types/database";

/**
 * Session state, held once at the root.
 *
 * The rule that matters here: when the probe fails we stay signed OUT. An
 * earlier version defaulted to "coordinator" when it could not reach the
 * service, which meant an unauthenticated visitor was handed a district
 * officer's console. Guessing a role is never the safe failure.
 */

interface AuthState {
  user: User | null;
  organisation: Organisation | null;
  role: UserRole | null;
  /** True until the first session probe settles. */
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  demoSignIn: (role: UserRole) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const missing = () => {
  throw new Error("AuthProvider is missing from the tree");
};

const AuthContext = createContext<AuthState>({
  user: null,
  organisation: null,
  role: null,
  loading: true,
  isAuthenticated: false,
  signIn: missing,
  demoSignIn: missing,
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const session = await api.fetchSession();
      setUser(session.user);
      setOrganisation(session.organisation);
    } catch {
      setUser(null);
      setOrganisation(null);
    }
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      await refresh();
      if (live) setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await api.signIn(email, password);
    if (!session?.user) {
      throw new Error("That sign-in did not return an account. Please try again.");
    }
    setUser(session.user);
    setOrganisation(session.organisation ?? null);
    return session.user;
  }, []);

  const demoSignIn = useCallback(
    async (role: UserRole) => {
      const result = await api.demoSignIn(role);
      setUser(result.user);
      // demo-login does not resolve the organisation; the probe does.
      await refresh();
      return result.user;
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    try {
      await api.signOut();
    } catch {
      // Clearing local state matters more than the round trip succeeding.
    }
    setUser(null);
    setOrganisation(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      organisation,
      role: user?.role ?? null,
      loading,
      isAuthenticated: Boolean(user),
      signIn,
      demoSignIn,
      signOut,
      refresh,
    }),
    [user, organisation, loading, signIn, demoSignIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
