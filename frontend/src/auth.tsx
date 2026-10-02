import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useContext, useEffect, useState } from "react";

import { api, clearTokens, getAccess, getRefresh, setTokens } from "@/src/api";

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roles: string[];
  permissions: string[];
  is_active: boolean;
  is_verified: boolean;
  avatar_url?: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: { name: string; email: string; password: string; phone?: string; role: string }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (body: { name?: string; phone?: string; avatar_url?: string }) => Promise<void>;
  has: (perm: string) => boolean;
  primaryRole: () => "super_admin" | "admin" | "owner" | "customer";
};

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    (async () => {
      const token = await getAccess();
      const refresh = await getRefresh();
      if (token || refresh) {
        try {
          const me = await api.get<User>("/auth/me");
          setUser(me);
        } catch {
          await clearTokens();
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password }, false);
    await setTokens(res.access_token, res.refresh_token);
    setUser(res.user);
    return res.user as User;
  };

  const register = async (body: any) => {
    const res = await api.post("/auth/register", body, false);
    await setTokens(res.access_token, res.refresh_token);
    setUser(res.user);
    return res.user as User;
  };

  const logout = async () => {
    const refresh = await getRefresh();
    try {
      if (refresh) await api.post("/auth/logout", { token: refresh });
    } catch {}
    await clearTokens();
    setUser(null);
    queryClient.clear();
  };

  const refreshUser = async () => {
    try {
      setUser(await api.get<User>("/auth/me"));
    } catch {}
  };

  const updateProfile = async (body: any) => {
    const updated = await api.patch<User>("/auth/me", body);
    setUser(updated);
  };

  const has = (perm: string) => !!user && (user.permissions.includes("*") || user.permissions.includes(perm));

  const primaryRole = (): AuthCtx["primaryRole"] extends () => infer R ? R : never => {
    const r = user?.roles || [];
    if (r.includes("super_admin")) return "super_admin" as any;
    if (r.includes("admin")) return "admin" as any;
    if (r.includes("owner")) return "owner" as any;
    return "customer" as any;
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refreshUser, updateProfile, has, primaryRole }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
