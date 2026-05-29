import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ErrorBanner from "../components/ErrorBanner";
import { api } from "../api/client";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  useEffect(() => {
    const value = searchParams.get("token") || "";
    setToken(value);

    if (!value) {
      setError("Missing reset token.");
      setCheckingToken(false);
      return;
    }

    api
      .get(`/auth/reset-password/${value}`)
      .then(() => {
        setCheckingToken(false);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Reset token is invalid or expired");
        setCheckingToken(false);
      });
  }, [searchParams]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess("Password updated. You can now sign in.");
      setTimeout(() => navigate("/auth"), 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reset password");
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
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Reset Password</p>
          <h1 className="mt-2 text-3xl font-extrabold">Create a new password</h1>
          <p className="mt-2 text-sm text-slate-300">Your new password must be at least 8 characters.</p>
        </motion.div>

        <ErrorBanner message={error} />
        {success && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {success}
          </div>
        )}

        {checkingToken ? (
          <p className="text-sm text-slate-300">Validating reset token...</p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter new password"
                required
                className="w-full rounded-xl border border-white/15 bg-[#0f172a] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition duration-300 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/25"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm new password"
                required
                className="w-full rounded-xl border border-white/15 bg-[#0f172a] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition duration-300 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/25"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || Boolean(error)}
              className="w-full rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-900 shadow-[0_0_26px_rgba(34,211,238,0.35)] transition duration-300 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update password"}
            </motion.button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-slate-400">
          <Link to="/auth" className="text-cyan-300 hover:text-cyan-200">Back to sign in</Link>
        </div>
      </div>
    </main>
  );
}
