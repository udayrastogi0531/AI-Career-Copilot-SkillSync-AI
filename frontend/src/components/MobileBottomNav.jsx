import { NavLink } from "react-router-dom";
import { Home, FileText, BriefcaseBusiness, MessageSquare, User } from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/builder", label: "Builder", icon: FileText },
  { to: "/job-match", label: "Match", icon: BriefcaseBusiness },
  { to: "/coach", label: "Coach", icon: MessageSquare },
  { to: "/profile", label: "Profile", icon: User }
];

export default function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-slate-950/90 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-xs ${
                  isActive ? "text-cyan-200" : "text-slate-400"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
