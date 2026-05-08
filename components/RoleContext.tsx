"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { UserRole } from "@/types";

interface RoleContextValue {
  role: UserRole;
}

const RoleContext = createContext<RoleContextValue>({ role: "loan_officer" });

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("loan_officer");

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      if (stored?.role) setRole(stored.role as UserRole);
    } catch {}
  }, []);

  return <RoleContext.Provider value={{ role }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}

export function RoleGate({ roles, children, fallback }: {
  roles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { role } = useRole();
  if (!roles.includes(role)) return fallback ? <>{fallback}</> : null;
  return <>{children}</>;
}
