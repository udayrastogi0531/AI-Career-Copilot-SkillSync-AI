import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { toast } from "sonner";
import { Mail, X, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";

export default function VerificationBanner() {
  const { user, checkVerificationStatus } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem("career_copilot_verification_dismissed");
    if (isDismissed === "true") {
      setDismissed(true);
    }
  }, []);

  // If user is not logged in, or already verified, or has dismissed the banner for this session, render nothing
  if (!user || user.isVerified || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem("career_copilot_verification_dismissed", "true");
    setDismissed(true);
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    
    try {
      const { data } = await api.post("/auth/resend-verification", { email: user.email });
      toast.success(data?.message || "Verification link has been resent! Please check your inbox.");
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to resend verification link.";
      toast.error(errorMsg);
    } finally {
      setResending(false);
    }
  };

  const handleCheckStatus = async () => {
    if (checking) return;
    setChecking(true);

    try {
      const isVerifiedNow = await checkVerificationStatus();
      if (isVerifiedNow) {
        toast.success("Congratulations! Your email has been successfully verified.");
      } else {
        toast.info("Your email is still unverified. Please check your inbox (including spam) or request a new link.");
      }
    } catch (err) {
      toast.error("Could not refresh status. Please try again later.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full px-4 pt-3 pb-1"
      >
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-amber-500/5 p-4 shadow-[0_8px_32px_rgba(245,158,11,0.06)] backdrop-blur-xl md:flex md:items-center md:justify-between md:gap-6">
          {/* Decorative glowing gradient circle */}
          <div className="pointer-events-none absolute -left-12 -top-12 h-24 w-24 rounded-full bg-amber-500/10 blur-xl" />

          {/* Banner content */}
          <div className="relative z-10 flex items-start gap-3 md:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-inner">
              <Mail className="h-5 w-5 text-amber-400 animate-pulse" />
            </div>
            
            <div>
              <h4 className="text-sm font-semibold text-amber-200">
                Please verify your email address
              </h4>
              <p className="mt-0.5 text-xs text-amber-300/80 max-w-2xl leading-relaxed">
                Check your inbox (<span className="font-mono text-amber-200">{user.email}</span>) for the verification link to unlock full platform capabilities. Didn't receive it?
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2.5 md:mt-0">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleResend}
              disabled={resending}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-3.5 py-1.5 text-xs font-semibold text-amber-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {resending ? "Resending..." : "Resend Link"}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleCheckStatus}
              disabled={checking}
              className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checking ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              )}
              {checking ? "Checking..." : "I've Verified"}
            </motion.button>

            {/* Dismiss X button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleDismiss}
              className="absolute right-0 top-0 p-1.5 rounded-lg text-amber-400/60 hover:text-amber-300 hover:bg-white/5 transition-all md:relative md:p-1.5"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
