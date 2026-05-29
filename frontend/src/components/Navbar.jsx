import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Moon, Sun, LogOut, User, Settings, Bell } from "lucide-react";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const { logout, user } = useAuth();

  const notifications = [
    { id: 1, title: "New ATS insights ready", time: "2m ago" },
    { id: 2, title: "Interview feedback scored 82%", time: "1h ago" },
    { id: 3, title: "Resume autosave completed", time: "Yesterday" }
  ];

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const navLinks = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/resume", label: "Resume" },
    { to: "/builder", label: "Builder" },
    { to: "/cover-letter", label: "Cover Letter" },
    { to: "/upload", label: "Upload" },
    { to: "/templates", label: "Templates" },
    { to: "/ats", label: "ATS" },
    { to: "/job-match", label: "Job Match" },
    { to: "/job-tracker", label: "Job Tracker" },
    { to: "/interview", label: "Interview" },
    { to: "/coach", label: "Coach" },
    { to: "/history", label: "History" },
    { to: "/profile", label: "Profile" }
  ];

  return (
    <div className="sticky top-0 z-50 px-4 pt-4 text-white md:px-8">
      <div className="glass-soft mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-cyan-400/20 p-4">
        <Link to="/dashboard" className="text-lg font-extrabold tracking-wide text-cyan-300 md:text-xl">
          AI Career Copilot
        </Link>

        <button
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-lg border border-cyan-500/30 px-3 py-1 text-sm font-semibold text-cyan-200 md:hidden"
          aria-label="Toggle menu"
        >
          Menu
        </button>

        <div className="hidden items-center gap-2 text-sm font-semibold md:flex">
          {navLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 transition ${
                  isActive
                    ? "border border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                    : "text-slate-300 hover:bg-white/10 hover:text-cyan-200"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          
          <button
            onClick={toggleTheme}
            className="rounded-lg border border-slate-500/30 p-2 text-slate-300 transition hover:bg-white/10 hover:text-cyan-200"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative rounded-lg border border-slate-500/30 p-2 text-slate-300 transition hover:bg-white/10 hover:text-cyan-200"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-[10px] font-bold text-slate-900">
                {notifications.length}
              </span>
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-lg border border-cyan-500/30 bg-slate-900/95 shadow-lg backdrop-blur z-50">
                <div className="border-b border-slate-700 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Notifications</p>
                  <p className="text-xs text-slate-400">Stay on top of your progress</p>
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  {notifications.map((note) => (
                    <div key={note.id} className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/5">
                      <p className="text-sm text-slate-200">{note.title}</p>
                      <p className="text-xs text-slate-500">{note.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-cyan-500/40 px-3 py-2 text-slate-300 transition hover:bg-cyan-500/10 hover:text-cyan-200"
              aria-label="User menu"
            >
              <User className="h-5 w-5" />
              <span className="hidden lg:inline text-xs">{user?.name?.split(" ")[0] || "User"}</span>
            </button>
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg border border-cyan-500/30 bg-slate-900/95 shadow-lg backdrop-blur z-50">
                <div className="border-b border-slate-700 px-4 py-3">
                  <p className="text-sm font-semibold text-white">{user?.name || "User"}</p>
                  <p className="text-xs text-slate-400">{user?.email || ""}</p>
                </div>
                <div className="space-y-1 p-2">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <User className="h-4 w-4" /> Profile
                  </Link>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Settings className="h-4 w-4" /> Settings
                  </Link>
                </div>
                <div className="border-t border-slate-700">
                  <button
                    onClick={() => {
                      logout();
                      setDropdownOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-b-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div className="glass-soft mt-3 flex flex-col gap-2 rounded-lg border border-cyan-500/20 p-3 text-sm font-semibold md:hidden">
          {navLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-2 py-1 transition ${
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
          
          <div className="border-t border-cyan-500/20 pt-2 mt-2">
            <button
              onClick={() => {
                toggleTheme();
                setOpen(false);
              }}
              className="flex items-center gap-2 rounded-md px-2 py-1 w-full text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? "Light Mode" : "Dark Mode"}
            </button>
          </div>

          <div className="border-t border-cyan-500/20 pt-2 mt-2">
            <p className="px-2 py-1 text-xs text-slate-400">Notifications</p>
            {notifications.map((note) => (
              <div key={note.id} className="rounded-md px-2 py-1 text-xs text-slate-300">
                {note.title}
              </div>
            ))}
          </div>

          <div className="border-t border-cyan-500/20 pt-2 mt-2">
            <p className="px-2 py-1 text-xs text-slate-400">{user?.name || "User"}</p>
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-md px-2 py-1 text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200"
              onClick={() => setOpen(false)}
            >
              <User className="h-4 w-4" /> Profile
            </Link>
            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="flex items-center gap-2 rounded-md px-2 py-1 w-full text-left text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
