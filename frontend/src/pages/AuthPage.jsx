import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Navigate, useNavigate } from "react-router-dom";
import ErrorBanner from "../components/ErrorBanner";
import { useAuth } from "../context/AuthContext";

const AuthPage = () => {
  const { isAuthenticated, login, register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const googleBtnRef = useRef(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !window.google || !googleBtnRef.current) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        if (!credential) {
          setError("Google login failed");
          return;
        }

        setGoogleLoading(true);
        setError("");
        try {
          await googleLogin(credential);
        } catch (err) {
          setError(err.response?.data?.message || "Google login failed");
        } finally {
          setGoogleLoading(false);
        }
      }
    });

    googleBtnRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      text: "continue_with",
      width: 320,
      shape: "rectangular"
    });
  }, [googleLogin]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const [successMsg, setSuccessMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
        navigate("/dashboard", { replace: true });
      } else {
        const data = await register(form);
        setSuccessMsg(data?.message || "Registration successful! Please check your email to verify your account.");
        setMode("login");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-6 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,255,0.15),transparent_50%)]" />
      <div className="pointer-events-none absolute -left-16 top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-16 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-5xl grid-cols-1 gap-10 md:grid md:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden md:flex md:flex-col md:justify-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">SkillSync AI</p>
          <h1 className="mt-4 text-5xl font-extrabold leading-tight text-white">Welcome to your new interview edge.</h1>
          <p className="mt-5 max-w-md text-slate-300">
            Unlock resume intelligence, smarter job targeting, and AI interview prep with a premium workflow.
          </p>
          <div className="mt-8 space-y-4 text-sm text-slate-300">
            <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">Real-time ATS analysis and skill-gap clarity.</p>
            <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">Job matching that blends AI reasoning with logic.</p>
            <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">Mock interviews that actually improve your answers.</p>
          </div>
        </motion.section>

        <motion.section
          key={mode}
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-white/15 bg-white/5 p-7 shadow-[0_24px_80px_rgba(2,6,23,0.6)] backdrop-blur-xl md:p-8"
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">{mode === "login" ? "Welcome Back" : "Create Account"}</h2>
            <div className="rounded-full border border-white/15 bg-slate-900/60 px-2 py-1 text-xs text-cyan-300">Secure Auth</div>
          </div>

          <div className="mb-7 grid grid-cols-2 rounded-xl border border-white/10 bg-slate-900/50 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setSuccessMsg("");
              }}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition duration-300 ${
                mode === "login" ? "bg-cyan-400 text-slate-900" : "text-slate-300 hover:bg-white/5"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
                setSuccessMsg("");
              }}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition duration-300 ${
                mode === "register" ? "bg-cyan-400 text-slate-900" : "text-slate-300 hover:bg-white/5"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "register" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <label className="mb-2 block text-sm font-medium text-slate-300">Full Name</label>
                <input
                  name="name"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={onChange}
                  required
                  className="w-full rounded-xl border border-white/15 bg-[#0f172a] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition duration-300 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/25"
                />
              </motion.div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Email</label>
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={onChange}
                required
                className="w-full rounded-xl border border-white/15 bg-[#0f172a] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition duration-300 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/25"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Password</label>
              <input
                name="password"
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={onChange}
                required
                className="w-full rounded-xl border border-white/15 bg-[#0f172a] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition duration-300 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/25"
              />
            </div>

            {mode === "login" && (
              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-cyan-300 hover:text-cyan-200"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <ErrorBanner message={error} />
            {successMsg && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {successMsg}
              </div>
            )}

            <div className="my-2 flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-white/10" />
              <span>or continue with</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-slate-900/60 p-0 h-[48px] flex items-center justify-center transition duration-300 hover:border-cyan-300/40 hover:bg-slate-900/80 hover:shadow-[0_0_20px_rgba(34,211,238,0.12)]">
                {/* 1. The Gorgeous Custom Styled Button (Visual Only, z-10) */}
                <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 text-sm font-semibold text-slate-200 pointer-events-none">
                  {/* Clean Google SVG Icon (without white background box!) */}
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </div>
                
                {/* 2. The Official Google Button (z-20, Opacity-0) */}
                <div 
                  ref={googleBtnRef} 
                  className="absolute inset-0 z-20 w-full h-full opacity-0 [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:cursor-pointer scale-[1.3]" 
                />
              </div>

              {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                <p className="text-center text-xs text-amber-300">Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in.</p>
              )}
              {googleLoading && <p className="text-center text-xs text-slate-300">Verifying Google account...</p>}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-900 shadow-[0_0_26px_rgba(34,211,238,0.35)] transition duration-300 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "AI analyzing..." : mode === "login" ? "Login" : "Create Account"}
            </motion.button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-400">
            {mode === "login" ? "New here? " : "Already registered? "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
              className="font-semibold text-cyan-300 transition hover:text-cyan-200"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </motion.section>
      </div>
    </main>
  );
}

export default AuthPage;
