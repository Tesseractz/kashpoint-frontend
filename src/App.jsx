import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  Package,
  BarChart3,
  LogOut,
  User,
  Menu,
  X,
  CreditCard,
  Sun,
  Moon,
  Settings,
  ChevronDown,
  Users,
  Receipt,
  Shield,
  ShieldCheck,
  Smartphone,
  LayoutDashboard,
  ArrowRightLeft,
} from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { usePlan } from "./hooks/usePlan";
import { useTheme } from "./context/ThemeContext";
import { Button } from "./components/ui/Button";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Logo, LogoIcon } from "./components/Logo";
import NotificationsBell from "./components/NotificationsBell";
import InfoStrip from "./components/InfoStrip";
import PushNotificationBanner from "./components/PushNotificationBanner";
import TrialBanner from "./components/TrialBanner";
import CookieConsent from "./components/CookieConsent";

const navItems = [
  { to: "/sell", icon: ShoppingCart, labelKey: "nav.sell", adminOnly: false },
  { to: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard", adminOnly: true },
  { to: "/transactions", icon: ArrowRightLeft, labelKey: "nav.transactions", adminOnly: true },
  { to: "/products", icon: Package, labelKey: "nav.products", adminOnly: false },
  { to: "/airtime", icon: Smartphone, labelKey: "nav.airtime", fallback: "Airtime & electricity", adminOnly: false },
  { to: "/customers", icon: Users, labelKey: "nav.customers", adminOnly: true },
  { to: "/expenses", icon: Receipt, labelKey: "nav.expenses", adminOnly: true },
  { to: "/users", icon: User, labelKey: "nav.users", adminOnly: true },
  { to: "/billing", icon: CreditCard, labelKey: "nav.billing", adminOnly: true },
  { to: "/privacy-settings", icon: Shield, labelKey: "nav.privacy", adminOnly: false },
];

// `match` marks the link active for a whole section (e.g. /admin and every
// page under it); `fallback` is the label when the i18n key has no entry.
function NavLink({ to, icon: Icon, labelKey, fallback, match, onClick }) {
  const location = useLocation();
  const { t } = useTranslation();
  const isActive = match ? location.pathname.startsWith(match) : location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={clsx(
        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm",
        "transition-all duration-200 ease-out-expo",
        // Brand-tinted active state with a subtle left accent stripe; hover lift on idle items.
        isActive
          ? "bg-brand-600 text-white shadow-brand"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60",
      )}
    >
      <Icon size={18} className={clsx("flex-shrink-0", isActive ? "" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200")} />
      <span>{fallback ? t(labelKey, fallback) : t(labelKey)}</span>
    </Link>
  );
}

function ThemeToggle({ compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  if (compact) {
    return (
      <button
        onClick={toggleTheme}
        className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label={theme === "dark" ? t("nav.light_mode") : t("nav.dark_mode")}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-all duration-200"
      aria-label={theme === "dark" ? t("nav.light_mode") : t("nav.dark_mode")}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      <span>{theme === "dark" ? t("nav.light_mode") : t("nav.dark_mode")}</span>
    </button>
  );
}

function UserDropdown() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="w-8 h-8 bg-accent-gradient rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-soft ring-1 ring-white/20">
          {user?.email?.charAt(0).toUpperCase() || "U"}
        </div>
        <ChevronDown
          size={16}
          className={clsx(
            "text-slate-500 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-soft-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-slide-down origin-top-right"
        >
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {user?.email}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Store Owner
            </p>
          </div>

          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
          >
            <Settings size={16} className="text-slate-500 dark:text-slate-400" />
            {t("nav.profile", "Profile & Settings")}
          </Link>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <LogOut size={16} />
            {t("nav.sign_out")}
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ mobile, onClose }) {
  const { t } = useTranslation();
  const { isAdmin, isPlatformAdmin } = useAuth();

  const { isSubscribedOrTrial } = usePlan();

  const visibleNavItems = navItems
    .filter(item => !item.adminOnly || isAdmin)
    .filter(item => {
      if (isSubscribedOrTrial) return true;
      // Minimal mode: keep only core + billing/settings
      return ["/sell", "/products", "/airtime", "/billing", "/privacy-settings"].includes(item.to);
    });

  return (
    <aside
      className={clsx(
        "flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800",
        mobile ? "w-full h-full" : "w-64 min-h-screen",
      )}
    >
      <div className="px-5 pt-6 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 transition-opacity hover:opacity-90 active:opacity-80"
            onClick={mobile ? onClose : undefined}
          >
            <Logo size={34} />
          </Link>
          {mobile && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            {...item}
            onClick={mobile ? onClose : undefined}
          />
        ))}

        {/* KashPoint staff and hardware partners: the portal above the stores.
            Not subject to the plan's minimal mode; the server gates it anyway. */}
        {isPlatformAdmin && (
          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
            <NavLink
              to="/admin"
              match="/admin"
              icon={ShieldCheck}
              labelKey="nav.admin_portal"
              fallback="Admin portal"
              onClick={mobile ? onClose : undefined}
            />
          </div>
        )}

        {/* Only show theme toggle in sidebar on desktop */}
        {!mobile && (
          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
            <ThemeToggle />
          </div>
        )}
      </nav>

      {/* Mobile-only bottom section */}
      {mobile && <MobileSidebarFooter onClose={onClose} />}
    </aside>
  );
}

function MobileSidebarFooter({ onClose }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
      <Link
        to="/profile"
        onClick={onClose}
        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">
          {user?.email?.charAt(0).toUpperCase() || "U"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
            {user?.email || "User"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Settings size={10} />
            {t("nav.profile", "Profile & Settings")}
          </p>
        </div>
      </Link>
      <Button
        variant="ghost"
        className="w-full justify-start"
        onClick={handleSignOut}
      >
        <LogOut size={18} />
        {t("nav.sign_out")}
      </Button>
    </div>
  );
}

function DesktopHeader() {
  return (
    <header className="hidden lg:flex h-16 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-6 items-center justify-between gap-4 sticky top-0 z-30">
      <InfoStrip />
      <div className="flex items-center gap-2 flex-shrink-0">
        <NotificationsBell />
        <ThemeToggle compact />
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
        <UserDropdown />
      </div>
    </header>
  );
}

function MobileHeader({ onMenuOpen }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 z-40 px-4 flex items-center justify-between safe-top">
      <Logo size={32} showText={false} />
      <div className="hidden min-[400px]:flex flex-1 justify-center px-2 min-w-0">
        <InfoStrip variant="mobile" />
      </div>
      <div className="flex items-center gap-0.5">
        <NotificationsBell />
        <button
          onClick={toggleTheme}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 touch-target flex items-center justify-center transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button
          onClick={onMenuOpen}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 touch-target flex items-center justify-center transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </div>
    </header>
  );
}

function MobileTabBar({ onMore }) {
  const location = useLocation();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const { isSubscribedOrTrial } = usePlan();

  const tabs = [
    { to: "/sell", icon: ShoppingCart, label: t("nav.sell"), adminOnly: false },
    { to: "/products", icon: Package, label: t("nav.products"), adminOnly: false },
    { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard", "Dashboard"), adminOnly: true },
    { to: "/profile", icon: User, label: t("nav.profile", "Profile"), adminOnly: false },
  ]
    .filter((tab) => !tab.adminOnly || isAdmin)
    .filter((tab) => {
      if (isSubscribedOrTrial) return true;
      // Minimal mode: hide premium tabs like Reports
      return ["/sell", "/products", "/profile"].includes(tab.to);
    });

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 safe-bottom">
      <div className="bg-white/85 dark:bg-slate-950/85 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800">
        <div className="flex items-stretch justify-around px-2 py-2 gap-1">
          {tabs.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 min-w-0 flex-1",
                  "transition-all duration-200 ease-out-expo touch-target",
                  isActive
                    ? "text-brand-600 dark:text-brand-400 bg-brand-50/80 dark:bg-brand-950/40"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                )}
              >
                <Icon size={20} className={clsx(isActive && "drop-shadow-sm")} />
                <span className="text-[11px] font-medium leading-none truncate max-w-full">
                  {label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={onMore}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 min-w-0 flex-1 transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 touch-target"
            aria-label={t("nav.more", "More")}
          >
            <Menu size={20} />
            <span className="text-[11px] font-medium leading-none truncate max-w-full">
              {t("nav.more", "More")}
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  const { isAuthenticated, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <LogoIcon size={64} />
          </div>
          <p className="text-slate-600 dark:text-slate-400">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 bg-mesh-light dark:bg-mesh-dark">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex overflow-x-hidden">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 animate-slide-up">
            <Sidebar mobile onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <MobileHeader onMenuOpen={() => setMobileMenuOpen(true)} />
        <DesktopHeader />

        <main className="flex-1 flex flex-col p-0 mobile-main-offset mobile-bottom-offset overflow-x-hidden min-w-0">
          <TrialBanner />
          <PushNotificationBanner />
          <div className="flex-1 p-3 sm:p-5 lg:p-8 w-full min-w-0">
            <div className="max-w-7xl mx-auto w-full">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <MobileTabBar onMore={() => setMobileMenuOpen(true)} />

      {/* Cookie Consent Banner */}
      <CookieConsent />
    </div>
  );
}
