"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TrendingUp, ArrowLeft, ShieldCheck, RefreshCw, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function OTPPage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [userId, setUserId] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("+250 78X XXX XXX");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const id = sessionStorage.getItem("otp_userId") || "";
    const phone = sessionStorage.getItem("otp_maskedPhone") || "+250 78X XXX XXX";
    if (!id) {
      router.replace("/login");
      return;
    }
    setUserId(id);
    setMaskedPhone(phone);
  }, [router]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const focusNext = useCallback((index: number) => {
    if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }, []);

  const focusPrev = useCallback((index: number) => {
    if (index > 0) inputRefs.current[index - 1]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    setError("");
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char) focusNext(index);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else {
        focusPrev(index);
      }
    } else if (e.key === "ArrowLeft") {
      focusPrev(index);
    } else if (e.key === "ArrowRight") {
      focusNext(index);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!text) return;
    const next = Array(OTP_LENGTH).fill("");
    text.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    const lastFilled = Math.min(text.length, OTP_LENGTH - 1);
    inputRefs.current[lastFilled]?.focus();
  };

  const handleResend = () => {
    // OTP is tied to the login request — redirect to login to generate a new one
    sessionStorage.removeItem("otp_userId");
    sessionStorage.removeItem("otp_maskedPhone");
    router.push("/login");
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < OTP_LENGTH) {
      setError("Please enter all 6 digits.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, otp: code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Invalid code. Please try again.");
        setDigits(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
        return;
      }
      // JWT cookie is set automatically via Set-Cookie header
      localStorage.setItem("user", JSON.stringify(json.data.user));
      sessionStorage.removeItem("otp_userId");
      sessionStorage.removeItem("otp_maskedPhone");
      setVerified(true);
      await new Promise((r) => setTimeout(r, 900));
      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filled = digits.filter(Boolean).length;
  const isComplete = filled === OTP_LENGTH;

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-[#052e16] flex-col items-center justify-center px-12">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-green-500/10 blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl translate-x-1/2 translate-y-1/2" />

        {/* Logo at top */}
        <div className="absolute top-12 left-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-900/40">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-lg leading-none">Ingobyi MIS</p>
              <p className="text-[11px] text-green-400/70 mt-0.5">Management Information System</p>
            </div>
          </div>
        </div>

        {/* Center visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative text-center"
        >
          {/* Shield icon with rings */}
          <div className="relative w-36 h-36 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" style={{ animationDuration: "3s" }} />
            <div className="absolute inset-4 rounded-full bg-green-500/15" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-900/50">
                <ShieldCheck className="w-9 h-9 text-white" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">Two-Factor Verification</h2>
          <p className="text-green-200/50 text-sm leading-relaxed max-w-xs mx-auto">
            This extra step confirms it's really you. Enter the one-time code sent to your registered device.
          </p>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              </div>
              <span className="text-xs text-green-400">Sign in</span>
            </div>
            <div className="w-8 h-px bg-green-500/30" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-xs font-bold text-white">2</span>
              </div>
              <span className="text-xs text-white font-medium">Verify OTP</span>
            </div>
            <div className="w-8 h-px bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-xs font-bold text-white/40">3</span>
              </div>
              <span className="text-xs text-white/30">Dashboard</span>
            </div>
          </div>
        </motion.div>

        <p className="absolute bottom-12 text-xs text-green-400/40">
          © 2026 Ingobyi Finance Ltd · Kigali, Rwanda
        </p>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white dark:bg-gray-950">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-md">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-base leading-none">Ingobyi MIS</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Management Information System</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[400px]"
        >
          {/* Back link */}
          <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mb-8">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to login
          </Link>

          {/* Header */}
          <div className="mb-8">
            <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-4">
              <ShieldCheck className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Enter OTP</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              We sent a 6-digit code to{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-300">{maskedPhone}</span>
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-6">
            {/* OTP Input Boxes */}
            <div>
              <div className="flex gap-2.5 justify-between" onPaste={handlePaste}>
                {digits.map((digit, i) => (
                  <motion.input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all focus:outline-none bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white
                      ${digit
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                        : "border-gray-200 dark:border-gray-700 focus:border-green-500 dark:focus:border-green-500"
                      }
                      ${error ? "border-red-400 dark:border-red-600 shake" : ""}
                    `}
                  />
                ))}
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                  animate={{ width: `${(filled / OTP_LENGTH) * 100}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">{filled}/{OTP_LENGTH} digits entered</p>
            </div>

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            {/* Verify Button */}
            <button
              type="submit"
              disabled={loading || !isComplete}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-md shadow-green-600/20 hover:shadow-lg hover:shadow-green-600/30 active:scale-[0.98]"
            >
              {verified ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Verified! Redirecting…
                </span>
              ) : loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Verifying code…
                </span>
              ) : (
                "Verify & Sign in"
              )}
            </button>

            {/* Resend */}
            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-xs text-gray-400">
                  Resend code in{" "}
                  <span className="font-semibold text-gray-600 dark:text-gray-300 tabular-nums">
                    {String(Math.floor(countdown / 60)).padStart(2, "0")}:{String(countdown % 60).padStart(2, "0")}
                  </span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 hover:underline disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
                  {resending ? "Sending new code…" : "Resend OTP"}
                </button>
              )}
            </div>
          </form>

          {/* Security note */}
          <div className="mt-6 flex items-start gap-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 rounded-xl p-3.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Never share your OTP with anyone. Ingobyi staff will never ask for your code.
            </p>
          </div>
        </motion.div>

        <p className="mt-8 text-xs text-gray-400 text-center">
          Protected by end-to-end encryption · Ingobyi Finance Ltd
        </p>
      </div>
    </div>
  );
}
