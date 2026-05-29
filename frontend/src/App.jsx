import { Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import PageTransition from "./components/PageTransition";
import ProtectedRoute from "./components/ProtectedRoute";
import Skeleton from "./components/Skeleton";
import { Toaster } from "./components/ui/sonner";
import MobileBottomNav from "./components/MobileBottomNav";
import FloatingCoach from "./components/FloatingCoach";
import { useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import LandingPage from "./pages/LandingPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import OnboardingPage from "./pages/OnboardingPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const InterviewPage = lazy(() => import("./pages/InterviewPage"));
const JobMatchPage = lazy(() => import("./pages/JobMatchPage"));
const JobTrackerPage = lazy(() => import("./pages/JobTrackerPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const CareerCoachPage = lazy(() => import("./pages/CareerCoachPage"));
const CoverLetterPage = lazy(() => import("./pages/CoverLetterPage"));
const ResumeAnalyzerPage = lazy(() => import("./pages/ResumeAnalyzerPage"));
const ResumeBuilderPage = lazy(() => import("./pages/ResumeBuilderPage"));
const ResumeHubPage = lazy(() => import("./pages/ResumeHubPage"));
const ResumeTemplatesPage = lazy(() => import("./pages/ResumeTemplatesPage"));
const ResumeUploadPage = lazy(() => import("./pages/ResumeUploadPage"));

const HistoryPage = lazy(() => import("./pages/HistoryPage"));

const PageFallback = (
  <div className="fade-in-up space-y-4 px-2 py-6">
    <Skeleton className="h-10 w-52" />
    <Skeleton className="h-28 w-full" />
    <div className="grid gap-4 md:grid-cols-2">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  </div>
);

const AppLayout = ({ children }) => {
  return (
    <div className="relative min-h-screen">
      <Navbar />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 md:px-8 md:pb-12"
      >
        <PageTransition>{children}</PageTransition>
      </motion.div>
      <FloatingCoach />
      <MobileBottomNav />
    </div>
  );
};

const App = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <AppLayout>
                <OnboardingPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={PageFallback}><DashboardPage /></Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/resume"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={PageFallback}><ResumeHubPage /></Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/builder"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={PageFallback}><ResumeBuilderPage /></Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={PageFallback}><ResumeUploadPage /></Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={PageFallback}><ResumeTemplatesPage /></Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ats"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={PageFallback}><ResumeAnalyzerPage /></Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/job-match"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={PageFallback}><JobMatchPage /></Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/job-tracker"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={PageFallback}><JobTrackerPage /></Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/interview"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={PageFallback}><InterviewPage /></Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coach"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={PageFallback}><CareerCoachPage /></Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cover-letter"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={PageFallback}><CoverLetterPage /></Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={<div className="px-6 py-10 text-slate-300">Loading history...</div>}>
                  <HistoryPage />
                </Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Suspense fallback={PageFallback}><ProfilePage /></Suspense>
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route path="/resume-builder" element={<Navigate to="/builder" replace />} />
        <Route path="/resume-analyzer" element={<Navigate to="/ats" replace />} />
        <Route path="/analyzer" element={<Navigate to="/ats" replace />} />
        <Route path="/job" element={<Navigate to="/job-match" replace />} />

        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </>
  );
};

export default App;
