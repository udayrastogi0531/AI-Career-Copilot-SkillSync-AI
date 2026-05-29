import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import ErrorBanner from "../components/ErrorBanner";
import { api } from "../api/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setResetUrl("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/forgot-password", { email: email.trim() });
      setSuccess("If an account exists, a reset link was generated.");
      if (data?.resetUrl) {
        setResetUrl(data.resetUrl);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to generate reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-6 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,255,0.15),transparent_50%)]" />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/15 bg-white/5 p-8 shadow-[0_24px_80px_rgba(2,6,23,0.6)] backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Account Recovery</p>
          <h1 className="mt-2 text-3xl font-extrabold">Forgot your password?</h1>
          <p className="mt-2 text-sm text-slate-300">Enter your email to receive a reset link.</p>
        </motion.div>

        <ErrorBanner message={error} />
        {success && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {success}
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-xl border border-white/15 bg-[#0f172a] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition duration-300 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/25"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-900 shadow-[0_0_26px_rgba(34,211,238,0.35)] transition duration-300 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Generating link..." : "Send reset link"}
          </motion.button>
        </form>

        {resetUrl && (
          <div className="mt-5 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-100">
            <p className="font-semibold">Reset link (dev mode)</p>
            <a href={resetUrl} className="mt-1 block break-all text-cyan-200 underline">
              {resetUrl}
            </a>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-slate-400">
          <Link to="/auth" className="text-cyan-300 hover:text-cyan-200">Back to sign in</Link>
        </div>
      </div>
    </main>
  );
}
