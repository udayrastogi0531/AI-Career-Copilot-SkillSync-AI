import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import ErrorBanner from "../components/ErrorBanner";
import { api } from "../api/client";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Resend Verification State
  const [email, setEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState("");
  const [resendError, setResendError] = useState("");

  const effectRan = useRef(false);

  useEffect(() => {
    if (!token) {
      setError("Verification token is missing. Please check your verification link or request a new one.");
      setLoading(false);
      return;
    }

    if (effectRan.current) return;
    effectRan.current = true;

    const verifyEmail = async () => {
      try {
        const { data } = await api.get(`/auth/verify-email?token=${token}`);
        setSuccess(data?.message || "Email verified successfully!");
      } catch (err) {
        setError(err.response?.data?.message || "Verification failed. The link may have expired or is invalid.");
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    setResendLoading(true);
    setResendError("");
    setResendSuccess("");

    try {
      const { data } = await api.post("/auth/resend-verification", { email: email.trim() });
      setResendSuccess(data?.message || "Verification email resent successfully!");
      setEmail("");
    } catch (err) {
      setResendError(err.response?.data?.message || "Unable to resend verification email.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-6 py-12 text-white">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.15),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(16,185,129,0.08),transparent_50%)]" />

      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/15 bg-white/5 p-8 shadow-[0_24px_80px_rgba(2,6,23,0.6)] backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 text-center"
        >
          <span className="inline-block rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold tracking-wider text-cyan-400 uppercase">
            Account Activation
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Email Verification</h1>
          <p className="mt-2 text-sm text-slate-400">
            Confirming your identity to unlock your Copilot dashboard.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="relative h-16 w-16">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="h-16 w-16 rounded-full border-4 border-cyan-400/25 border-t-cyan-400"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-cyan-400 text-xs font-bold">STC</span>
              </div>
            </div>
            <p className="text-cyan-400 font-medium animate-pulse text-sm">
              Verifying security token...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {error && <ErrorBanner message={error} />}

            {success && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-4"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Verification Complete</h3>
                  <p className="mt-2 text-sm text-emerald-100/80">{success}</p>
                </div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    to="/auth"
                    className="mt-2 inline-block w-full rounded-xl bg-emerald-500 px-6 py-3 font-bold text-slate-900 shadow-[0_0_24px_rgba(16,185,129,0.3)] transition duration-300 hover:bg-emerald-400"
                  >
                    Proceed to Login
                  </Link>
                </motion.div>
              </motion.div>
            )}

            {/* Resend Verification Form if verification failed or token is missing */}
            {!success && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="border-t border-white/10 pt-6 space-y-4"
              >
                <h2 className="text-sm font-semibold text-slate-300">Need a new verification link?</h2>
                <p className="text-xs text-slate-400">
                  Enter your email address and we'll dispatch a fresh activation token to your inbox.
                </p>

                {resendError && <ErrorBanner message={resendError} />}
                {resendSuccess && (
                  <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    {resendSuccess}
                  </div>
                )}

                <form onSubmit={handleResend} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      className="w-full rounded-xl border border-white/15 bg-[#0f172a] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition duration-300 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/25"
                    />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={resendLoading}
                    className="w-full rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-900 shadow-[0_0_24px_rgba(34,211,238,0.25)] transition duration-300 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 text-sm"
                  >
                    {resendLoading ? "Resending link..." : "Resend Verification Link"}
                  </motion.button>
                </form>
              </motion.div>
            )}

            <div className="text-center text-sm text-slate-400">
              <Link to="/auth" className="text-cyan-300 hover:text-cyan-200">
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
