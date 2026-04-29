"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TrendingUp, ArrowLeft, Mail, ShieldCheck, Eye, EyeOff, CheckCircle2, RefreshCw, Lock } from "lucide-react";
import Link from "next/link";

const OTP_LENGTH = 6;

type Step = "email" | "otp" | "password" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step,        setStep]        = useState<Step>("email");
  const [email,       setEmail]       = useState("");
  const [userId,      setUserId]      = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [digits,      setDigits]      = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [countdown,   setCountdown]   = useState(60);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step !== "otp" || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [step, countdown]);

  // ── Step 1: request OTP ───────────────────────────────────────────────────

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/v1/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Request failed."); return; }
      if (!json.data.userId) {
        // Email not found but we show a generic success to avoid enumeration
        setError("If that email is registered, an OTP has been sent to the linked phone number.");
        return;
      }
      setUserId(json.data.userId);
      setMaskedPhone(json.data.maskedPhone ?? "");
      setCountdown(60);
      setStep("otp");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP ────────────────────────────────────────────────────

  const focusNext = useCallback((i: number) => { inputRefs.current[i + 1]?.focus(); }, []);
  const focusPrev = useCallback((i: number) => { inputRefs.current[i - 1]?.focus(); }, []);

  const handleDigitChange = (i: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    setError("");
    const next = [...digits]; next[i] = char; setDigits(next);
    if (char && i < OTP_LENGTH - 1) focusNext(i);
  };

  const handleDigitKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i]) { const n = [...digits]; n[i] = ""; setDigits(n); }
      else focusPrev(i);
    } else if (e.key === "ArrowLeft") focusPrev(i);
    else if (e.key === "ArrowRight") focusNext(i);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!text) return;
    const next = Array(OTP_LENGTH).fill("");
    text.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    inputRefs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < OTP_LENGTH) { setError("Please enter all 6 digits."); return; }
    setError(""); setLoading(true);
    try {
      // Just move to password step — actual verification happens on final submit
      setStep("password");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/v1/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to resend."); return; }
      setDigits(Array(OTP_LENGTH).fill(""));
      setCountdown(60);
      inputRefs.current[0]?.focus();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: set new password ──────────────────────────────────────────────

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPass) { setError("Passwords do not match."); return; }
    if (newPassword.length < 6)      { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/v1/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId, otp: digits.join(""), newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        // OTP was wrong or expired — send back to OTP step
        setError(json.error ?? "Reset failed.");
        if (json.error?.toLowerCase().includes("otp") || json.error?.toLowerCase().includes("invalid")) {
          setStep("otp");
          setDigits(Array(OTP_LENGTH).fill(""));
        }
        return;
      }
      setStep("done");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── UI helpers ────────────────────────────────────────────────────────────

  const filled = digits.filter(Boolean).length;

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-[#052e16] flex-col items-center justify-center px-12">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-green-500/10 blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl translate-x-1/2 translate-y-1/2" />

        <div className="absolute top-12 left-12 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-lg leading-none">Ingobyi MIS</p>
            <p className="text-[11px] text-green-400/70 mt-0.5">Management Information System</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="relative w-36 h-36 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" style={{ animationDuration: "3s" }} />
            <div className="absolute inset-4 rounded-full bg-green-500/15" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-2xl">
                <Lock className="w-9 h-9 text-white" />
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Password Reset</h2>
          <p className="text-green-200/50 text-sm leading-relaxed max-w-xs mx-auto">
            We'll send a one-time code to your registered phone number to verify your identity.
          </p>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mt-8">
            {[
              { label: "Email", key: "email" },
              { label: "OTP",   key: "otp"   },
              { label: "New Password", key: "password" },
            ].map((s, i) => {
              const stepOrder: Step[] = ["email", "otp", "password", "done"];
              const current = stepOrder.indexOf(step);
              const thisStep = stepOrder.indexOf(s.key as Step);
              const done = current > thisStep;
              const active = current === thisStep;
              return (
                <div key={s.key} className="flex items-center gap-2">
                  {i > 0 && <div className={`w-6 h-px ${done ? "bg-green-500" : "bg-white/10"}`} />}
                  <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      done ? "bg-green-500 text-white" : active ? "bg-green-600 text-white" : "bg-white/10 text-white/30"
                    }`}>
                      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className={`text-xs ${active ? "text-white font-medium" : done ? "text-green-400" : "text-white/30"}`}>
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        <p className="absolute bottom-12 text-xs text-green-400/40">© 2026 CREDLY SOFTWARE SOLUTIONS · Kigali, Rwanda</p>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white dark:bg-gray-950">
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-md">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <p className="font-bold text-gray-900 dark:text-white text-base">Ingobyi MIS</p>
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[400px]"
        >
          {/* ── Step 1: Email ── */}
          {step === "email" && (
            <>
              <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mb-8">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to login
              </Link>
              <div className="mb-8">
                <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-4">
                  <Mail className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Forgot password?</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                  Enter your email and we'll send an OTP to your registered phone number.
                </p>
              </div>
              <form onSubmit={handleRequestOtp} className="space-y-5">
                {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.rw"
                      required
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-md shadow-green-600/20"
                >
                  {loading ? (
                    <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> Sending…</>
                  ) : "Send OTP"}
                </button>
              </form>
            </>
          )}

          {/* ── Step 2: OTP ── */}
          {step === "otp" && (
            <>
              <button onClick={() => { setStep("email"); setError(""); }} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mb-8">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <div className="mb-8">
                <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Enter OTP</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                  We sent a 6-digit code to{" "}
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{maskedPhone || "your phone"}</span>
                </p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div>
                  <div className="flex gap-2.5 justify-between" onPaste={handlePaste}>
                    {digits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(i, e.target.value)}
                        onKeyDown={(e) => handleDigitKey(i, e)}
                        onFocus={(e) => e.target.select()}
                        className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all focus:outline-none bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white ${
                          digit ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                                : "border-gray-200 dark:border-gray-700 focus:border-green-500"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-3 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                      animate={{ width: `${(filled / OTP_LENGTH) * 100}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">{filled}/{OTP_LENGTH} digits entered</p>
                </div>

                {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}

                <button
                  type="submit"
                  disabled={filled < OTP_LENGTH || loading}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-md shadow-green-600/20"
                >
                  Continue
                </button>

                <div className="text-center">
                  {countdown > 0 ? (
                    <p className="text-xs text-gray-400">
                      Resend in <span className="font-semibold text-gray-600 dark:text-gray-300 tabular-nums">
                        {String(Math.floor(countdown / 60)).padStart(2, "0")}:{String(countdown % 60).padStart(2, "0")}
                      </span>
                    </p>
                  ) : (
                    <button type="button" onClick={handleResend} disabled={loading}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 hover:underline disabled:opacity-50">
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                      Resend OTP
                    </button>
                  )}
                </div>
              </form>
            </>
          )}

          {/* ── Step 3: New Password ── */}
          {step === "password" && (
            <>
              <button onClick={() => { setStep("otp"); setError(""); }} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mb-8">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <div className="mb-8">
                <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-4">
                  <Lock className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Set new password</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                  Choose a strong password for your account.
                </p>
              </div>
              <form onSubmit={handleResetPassword} className="space-y-4">
                {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPass ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      autoFocus
                      className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                    <button type="button" onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPass ? "text" : "password"}
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-md shadow-green-600/20 mt-2"
                >
                  {loading ? (
                    <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> Resetting…</>
                  ) : "Reset Password"}
                </button>
              </form>
            </>
          )}

          {/* ── Step 4: Done ── */}
          {step === "done" && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Password reset!</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                Your password has been updated successfully. You can now sign in with your new password.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-md shadow-green-600/20"
              >
                Back to Login
              </button>
            </motion.div>
          )}
        </motion.div>

        <p className="mt-8 text-xs text-gray-400 text-center">
          Protected by end-to-end encryption · CREDLY SOFTWARE SOLUTIONS
        </p>
      </div>
    </div>
  );
}
