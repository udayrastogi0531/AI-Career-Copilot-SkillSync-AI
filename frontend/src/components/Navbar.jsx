import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  Moon, 
  Sun, 
  LogOut, 
  User, 
  Settings, 
  Bell, 
  FileText, 
  UploadCloud, 
  Mic, 
  Briefcase, 
  ChevronDown, 
  CheckSquare, 
  Clock,
  Menu,
  X,
  History
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const { logout, user } = useAuth();

  const [notifications, setNotifications] = useState([
    { id: 1, title: "ATS audit report compiled for Resume", time: "2m ago", unread: true, type: "ats" },
    { id: 2, title: "Resume PDF parsed successfully", time: "15m ago", unread: true, type: "resume" },
    { id: 3, title: "Voice mock interview scored 84%", time: "1h ago", unread: false, type: "interview" },
    { id: 4, title: "New target job match index 92%", time: "3h ago", unread: false, type: "job" },
    { id: 5, title: "Add focus skills to unlock roadmaps", time: "Yesterday", unread: false, type: "profile" }
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const toggleNotificationRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: !n.unread } : n));
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "ats":
        return <FileText className="text-cyan-400 h-4 w-4" />;
      case "resume":
        return <UploadCloud className="text-emerald-400 h-4 w-4" />;
      case "interview":
        return <Mic className="text-violet-400 h-4 w-4" />;
      case "job":
        return <Briefcase className="text-amber-400 h-4 w-4" />;
      case "profile":
        return <User className="text-pink-400 h-4 w-4" />;
      default:
        return <Bell className="text-slate-400 h-4 w-4" />;
    }
  };

  // Grouped for Mobile list view
  const navLinks = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/resume", label: "Resume Hub" },
    { to: "/builder", label: "Resume Builder" },
    { to: "/cover-letter", label: "Cover Letter" },
    { to: "/upload", label: "PDF Parser" },
    { to: "/templates", label: "Templates" },
    { to: "/ats", label: "ATS Scanner" },
    { to: "/job-match", label: "Job Matcher" },
    { to: "/job-tracker", label: "Job Tracker" },
    { to: "/interview", label: "Interview Prep" },
    { to: "/coach", label: "Career Coach" },
    { to: "/history", label: "History Log" }
  ];

  return (
    <div className="sticky top-0 z-50 px-4 pt-4 text-white md:px-8">
      <div className="glass-soft mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-cyan-400/20 p-4">
        {/* Logo left */}
        <Link to="/dashboard" className="text-lg font-extrabold tracking-wide text-cyan-300 md:text-xl flex items-center gap-2">
          <span className="bg-gradient-to-r from-cyan-400 to-cyan-200 bg-clip-text text-transparent">AI Career Copilot</span>
        </Link>

        {/* Hamburger Menu Toggle (Mobile) */}
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-lg border border-cyan-500/30 p-1.5 text-cyan-200 md:hidden hover:bg-white/5 transition"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Navigation Core links (Center, Desktop) */}
        <div className="hidden items-center gap-1.5 text-sm font-semibold md:flex">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 transition duration-200 ${
                isActive
                  ? "border border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                  : "text-slate-300 hover:bg-white/10 hover:text-cyan-200"
              }`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/resume"
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 transition duration-200 ${
                isActive
                  ? "border border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                  : "text-slate-300 hover:bg-white/10 hover:text-cyan-200"
              }`
            }
          >
            Resume Hub
          </NavLink>
          <NavLink
            to="/interview"
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 transition duration-200 ${
                isActive
                  ? "border border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                  : "text-slate-300 hover:bg-white/10 hover:text-cyan-200"
              }`
            }
          >
            Interview Prep
          </NavLink>
          <NavLink
            to="/coach"
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 transition duration-200 ${
                isActive
                  ? "border border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                  : "text-slate-300 hover:bg-white/10 hover:text-cyan-200"
              }`
            }
          >
            Career Coach
          </NavLink>

          {/* AI Tools Dropdown Menu (Desktop) */}
          <div 
            className="relative"
            onMouseEnter={() => setToolsOpen(true)}
            onMouseLeave={() => setToolsOpen(false)}
          >
            <button
              onClick={() => setToolsOpen(!toolsOpen)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition duration-200 text-slate-300 hover:bg-white/10 hover:text-cyan-200 ${
                toolsOpen ? "text-cyan-200 bg-white/5" : ""
              }`}
            >
              <span>AI Tools</span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-250 ${toolsOpen ? "rotate-180" : ""}`} />
            </button>
            
            <AnimatePresence>
              {toolsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 mt-2 w-52 rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-2xl z-50 space-y-1"
                >
                  <Link
                    to="/builder"
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200 transition"
                    onClick={() => setToolsOpen(false)}
                  >
                    <CheckSquare className="h-4 w-4 text-cyan-400" /> Resume Builder
                  </Link>
                  <Link
                    to="/cover-letter"
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200 transition"
                    onClick={() => setToolsOpen(false)}
                  >
                    <FileText className="h-4 w-4 text-emerald-400" /> Cover Letter
                  </Link>
                  <Link
                    to="/ats"
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200 transition"
                    onClick={() => setToolsOpen(false)}
                  >
                    <UploadCloud className="h-4 w-4 text-pink-400" /> ATS Scanner
                  </Link>
                  <Link
                    to="/job-match"
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200 transition"
                    onClick={() => setToolsOpen(false)}
                  >
                    <Briefcase className="h-4 w-4 text-amber-400" /> Job Matcher
                  </Link>
                  <Link
                    to="/job-tracker"
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200 transition"
                    onClick={() => setToolsOpen(false)}
                  >
                    <Settings className="h-4 w-4 text-violet-400" /> Job Tracker
                  </Link>
                  <Link
                    to="/history"
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200 transition"
                    onClick={() => setToolsOpen(false)}
                  >
                    <History className="h-4 w-4 text-slate-400" /> History Log
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Actions Alignment (Desktop) */}
        <div className="hidden items-center gap-3 text-sm font-semibold md:flex">
          <button
            onClick={toggleTheme}
            className="rounded-lg border border-slate-500/30 p-2 text-slate-300 transition hover:bg-white/10 hover:text-cyan-200"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Stateful Notification Icon Area */}
          <div className="relative">
            <button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setDropdownOpen(false);
              }}
              className={`relative rounded-lg border border-slate-500/30 p-2 text-slate-300 transition hover:bg-white/10 hover:text-cyan-200 ${
                notificationsOpen ? "bg-white/10 text-cyan-200 border-cyan-500/30" : ""
              }`}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-[9px] font-extrabold text-slate-950 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.7)]">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Redesigned Glassmorphic Notification panel */}
            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="fixed top-[84px] left-4 right-4 w-[calc(100vw-32px)] md:absolute md:top-auto md:left-auto md:right-0 md:mt-3 md:w-[380px] rounded-3xl border border-white/15 bg-slate-950/90 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl z-50 flex flex-col space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">Notifications</h3>
                      <p className="text-[10px] text-slate-400">Stay updated on your application status</p>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 space-y-2 text-slate-400">
                        <Bell className="h-8 w-8 opacity-40" />
                        <p className="text-xs">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((note) => {
                        const Icon = getNotificationIcon(note.type);
                        return (
                          <div
                            key={note.id}
                            onClick={() => toggleNotificationRead(note.id)}
                            className={`flex gap-3 items-start rounded-2xl p-3 text-[11px] transition duration-200 cursor-pointer ${
                              note.unread 
                                ? "border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10" 
                                : "border border-transparent hover:bg-white/5"
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5 rounded-xl bg-slate-900 p-2 border border-white/5">
                              {Icon}
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className={`text-slate-200 leading-normal ${note.unread ? "font-semibold text-white" : ""}`}>
                                {note.title}
                              </p>
                              <p className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                                <Clock className="h-3 w-3" /> {note.time}
                              </p>
                            </div>
                            {note.unread && (
                              <span className="h-2 w-2 rounded-full bg-cyan-400 mt-1.5 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Menu Dropdown (Desktop) */}
          <div className="relative">
            <button
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                setNotificationsOpen(false);
              }}
              className={`flex items-center gap-2 rounded-lg border border-cyan-500/40 px-3 py-2 text-slate-300 transition hover:bg-cyan-500/10 hover:text-cyan-200 ${
                dropdownOpen ? "bg-cyan-500/10 text-cyan-200 border-cyan-500/60" : ""
              }`}
              aria-label="User menu"
            >
              <User className="h-5 w-5" />
              <span className="hidden lg:inline text-xs font-semibold">{user?.name?.split(" ")[0] || "User"}</span>
            </button>
            
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-52 rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-2xl z-50 space-y-1 p-1"
                >
                  <div className="border-b border-white/10 px-4 py-3">
                    <p className="text-xs font-bold text-white leading-tight">{user?.name || "User"}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{user?.email || ""}</p>
                  </div>
                  <div className="p-1 space-y-0.5">
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200 transition"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <User className="h-4 w-4" /> Profile
                    </Link>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200 transition"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                  </div>
                  <div className="border-t border-white/10 p-1">
                    <button
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
                    >
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Hamburger Collapse Menu Drawer (Mobile) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="glass-soft mt-3 overflow-hidden rounded-2xl border border-cyan-500/20 p-3 text-sm font-semibold md:hidden flex flex-col gap-2"
          >
            <div className="grid grid-cols-2 gap-1.5 p-1">
              {navLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-2.5 text-xs font-bold transition flex items-center justify-center ${
                      isActive
                        ? "border border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                        : "hover:bg-cyan-500/10 hover:text-cyan-300"
                    }`
                  }
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
            
            <div className="border-t border-cyan-500/20 pt-2 mt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  toggleTheme();
                  setOpen(false);
                }}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200 transition"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{isDark ? "Light Theme" : "Dark Theme"}</span>
              </button>
            </div>

            <div className="border-t border-cyan-500/20 pt-2 mt-2">
              <p className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-500">Notifications</p>
              <div className="max-h-40 overflow-y-auto space-y-1.5 mt-1.5 px-1 custom-scrollbar">
                {notifications.map((note) => (
                  <div 
                    key={note.id} 
                    onClick={() => toggleNotificationRead(note.id)}
                    className={`rounded-xl px-3 py-2.5 text-xs flex justify-between items-center gap-2 transition duration-200 cursor-pointer ${
                      note.unread ? "bg-cyan-500/5 text-white" : "text-slate-400 hover:bg-white/5"
                    }`}
                  >
                    <span className="truncate leading-normal">{note.title}</span>
                    {note.unread && (
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-cyan-500/20 pt-2 mt-2">
              <p className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-500">User Account</p>
              <div className="flex flex-col gap-1.5 mt-1">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200 transition"
                  onClick={() => setOpen(false)}
                >
                  <User className="h-4 w-4" /> <span>Profile Settings</span>
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition"
                >
                  <LogOut className="h-4 w-4" /> <span>Logout Session</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
