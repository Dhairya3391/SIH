'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserRole } from '@/types/database';
import { demoLogin, fetchDemoUser } from '@/lib/api';

export interface User {
  id: string;
  role: UserRole;
  org_id: string | null;
  region_id: string;
  district: string | null;
  language: string;
  full_name: string | null;
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  updateRole: (newRole: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: 'coordinator',
  loading: true,
  updateRole: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('coordinator');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchDemoUser().then((data) => {
      if (mounted) {
        if (data && data.user) {
          setUser(data.user);
          setRole(data.user.role);
        } else {
          // Fallback to coordinator if no active session is found
          setRole('coordinator');
        }
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });
    
    return () => { mounted = false; };
  }, []);

  const updateRole = async (newRole: UserRole) => {
    setLoading(true);
    try {
      const data = await demoLogin(newRole);
      if (data && data.user) {
        setUser(data.user);
        setRole(data.user.role);
      }
    } catch (err) {
      console.error("Failed to switch demo role", err);
      // Even if API fails (e.g. BACKEND_ORIGIN not set), change local state for demo visually
      setRole(newRole);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, updateRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
