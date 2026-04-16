import { Outlet, Link, useLocation } from "react-router-dom";
import InstallPWA from "./InstallPWA";
import LanguageToggle from "./LanguageToggle";
import { LayoutDashboard, Monitor, Clock, Settings, BarChart2, Users, Receipt, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/I18nContext";

const navDefs = [
  { path: "/",          key: "nav.dashboard", icon: LayoutDashboard },
  { path: "/consoles",  key: "nav.consoles",  icon: Monitor },
  { path: "/sessions",  key: "nav.sessions",  icon: Clock },
  { path: "/players",   key: "nav.players",   icon: Users },
  { path: "/expenses",  key: "nav.expenses",  icon: Receipt },
  { path: "/analytics", key: "nav.analytics", icon: TrendingUp },
  { path: "/report",    key: "nav.report",    icon: BarChart2 },
  { path: "/settings",  key: "nav.settings",  icon: Settings },
];

export default function Layout() {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-game-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-game-border bg-game-surface px-4 md:px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">PS</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-lg leading-none">{t('app.name')}</h1>
          <p className="text-game-muted text-xs">{t('app.subtitle')}</p>
        </div>
        <LanguageToggle />
      </header>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex flex-col w-56 border-r border-game-border bg-game-surface py-6 gap-1 shrink-0 overflow-y-auto">
          {navDefs.map(({ path, key, icon: Icon }) => (
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
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{t(key)}</span>
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
      <nav className="md:hidden border-t border-game-border bg-game-surface flex overflow-x-auto">
        {navDefs.map(({ path, key, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={cn(
              "flex-1 min-w-[3.5rem] flex flex-col items-center gap-1 py-2 text-xs font-medium transition-all",
              location.pathname === path ? "text-blue-400" : "text-game-muted"
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="truncate text-[10px]">{t(key)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
