"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeCtx {
  theme: string;         // resolved: "light" | "dark"
  resolvedTheme: string; // alias kept for compat
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "light", resolvedTheme: "light", setTheme: () => {} });

export function useTheme() {
  return useContext(Ctx);
}

function resolve(raw: Theme): "light" | "dark" {
  if (raw === "system") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark" : "light";
  }
  return raw;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [raw, setRaw] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("theme") as Theme) ?? "system";
  });

  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    typeof window === "undefined" ? "light" : resolve((localStorage.getItem("theme") as Theme) ?? "system")
  );

  useEffect(() => {
    const r = resolve(raw);
    setResolved(r);
    document.documentElement.classList.toggle("dark", r === "dark");
    localStorage.setItem("theme", raw);
  }, [raw]);

  useEffect(() => {
    if (raw !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = mq.matches ? "dark" : "light";
      setResolved(r);
      document.documentElement.classList.toggle("dark", r === "dark");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [raw]);

  return (
    <Ctx.Provider value={{ theme: resolved, resolvedTheme: resolved, setTheme: setRaw }}>
      {children}
    </Ctx.Provider>
  );
}
