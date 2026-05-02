"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import type { UserRole } from "@/types";

function getInitialRole(): UserRole {
  if (typeof window !== "undefined") {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      if (stored?.role) return stored.role as UserRole;
    } catch {}
  }
  return "loan_officer";
}

interface RoleContextValue {
  role: UserRole;
}

const RoleContext = createContext<RoleContextValue>({ role: "loan_officer" });

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role] = useState<UserRole>(getInitialRole);
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
