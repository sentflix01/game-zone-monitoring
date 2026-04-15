import { Outlet, Link, useLocation } from "react-router-dom";
import InstallPWA from "./InstallPWA";
import { LayoutDashboard, Monitor, Clock, Settings, BarChart2, Users, Receipt, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/consoles", label: "Consoles", icon: Monitor },
  { path: "/sessions", label: "Sessions", icon: Clock },
  { path: "/players", label: "Players", icon: Users },
  { path: "/expenses", label: "Expenses", icon: Receipt },
  { path: "/analytics", label: "Analytics", icon: TrendingUp },
  { path: "/report", label: "Report", icon: BarChart2 },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-game-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-game-border bg-game-surface px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold">PS</span>
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-none">Game Zone</h1>
          <p className="text-game-muted text-xs">Football Manager</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex flex-col w-56 border-r border-game-border bg-game-surface py-6 gap-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-3 mx-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                location.pathname === path
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-game-muted hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </aside>

        {/* Main */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      <InstallPWA />

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden border-t border-game-border bg-game-surface flex">
        {navItems.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-all",
              location.pathname === path ? "text-blue-400" : "text-game-muted"
            )}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}