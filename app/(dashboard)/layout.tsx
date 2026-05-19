"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { LogOut, Clock } from "lucide-react";

const IDLE_MS  = 30 * 60 * 1000; // 30 minutes total idle time
const WARN_MS  = 30 * 1000;      // show warning 30 s before logout

function IdleWarningModal({ secondsLeft, onStay, onLogout }: {
  secondsLeft: number;
  onStay: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl p-7 max-w-sm w-full mx-4 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 mx-auto mb-4">
          <Clock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Still there?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          You&apos;ve been inactive. You&apos;ll be logged out in{" "}
          <span className="font-bold text-amber-600 dark:text-amber-400">{secondsLeft}s</span>.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
          <button
            onClick={onStay}
            className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
          >
            Stay logged in
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARN_MS / 1000);
  const router     = useRouter();
  const countRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  // Holds the latest reset fn from the hook so callbacks defined before the hook can call it
  const resetRef   = useRef<(() => void) | null>(null);

  const stopCountdown = useCallback(() => {
    if (countRef.current) { clearInterval(countRef.current); countRef.current = null; }
  }, []);

  const doLogout = useCallback(async () => {
    stopCountdown();
    setShowWarning(false);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    localStorage.removeItem("user");
    router.push("/login");
  }, [router, stopCountdown]);

  const handleWarn = useCallback(() => {
    setSecondsLeft(WARN_MS / 1000);
    setShowWarning(true);
    countRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(countRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  }, []);

  const { reset } = useIdleTimeout({
    idleMs: IDLE_MS,
    warnMs: WARN_MS,
    onWarn: handleWarn,
    onIdle: doLogout,
  });

  // Keep the ref in sync so handleStay (below) always calls the latest reset
  useEffect(() => { resetRef.current = reset; }, [reset]);

  const handleStay = useCallback(() => {
    stopCountdown();
    setShowWarning(false);
    resetRef.current?.();
  }, [stopCountdown]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {showWarning && (
        <IdleWarningModal
          secondsLeft={secondsLeft}
          onStay={handleStay}
          onLogout={doLogout}
        />
      )}

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — off-canvas on mobile, inline on desktop */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <Sidebar onMobileClose={() => setMobileOpen(false)} />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
