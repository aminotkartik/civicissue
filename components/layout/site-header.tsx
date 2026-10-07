"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  LayoutDashboard,
  LogOut,
  Map,
  Search,
  Settings,
  Shield,
  User,
  Users,
  Wrench,
  Plus,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils/format";
import type { UserRole } from "@/lib/types";

export interface HeaderUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profileImage: string | null;
}

const NAV = [
  { href: "/issues", label: "Explore" },
  { href: "/map", label: "Map" },
  { href: "/community", label: "Community" },
  { href: "/resolved", label: "Resolved" },
];

export function SiteHeader({ user, unreadCount }: { user: HeaderUser | null; unreadCount?: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const roleHome = user
    ? user.role === "ADMIN"
      ? "/admin"
      : user.role === "AUTHORITY"
        ? "/authority"
        : user.role === "WORKER"
          ? "/worker"
          : "/dashboard"
    : "/";

  return (
    <header className="sticky top-0 z-[900] border-b border-line bg-canvas/92 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-terra-50 text-terra-700"
                  : "text-ink-soft hover:bg-surface-2 hover:text-ink"
              )}
            >
              {item.label}
            </Link>
          ))}
          {user && (
            <Link
              href={roleHome}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(roleHome) ? "bg-terra-50 text-terra-700" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
              )}
            >
              Dashboard
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Search (desktop) */}
          <form
            className="relative hidden md:block"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (searchValue.trim()) window.location.href = `/issues?q=${encodeURIComponent(searchValue.trim())}`;
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <input
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search issues or CIV-ID…"
              aria-label="Search civic issues"
              className="h-9 w-44 rounded-lg border border-line bg-surface pl-9 pr-3 text-[13px] placeholder:text-ink-muted focus:w-64 focus:border-terra-400 focus:outline-none focus:ring-2 focus:ring-terra-200 transition-all lg:w-52"
            />
          </form>

          <Link
            href="/report"
            className="hidden h-9 items-center gap-1.5 rounded-lg bg-terra-600 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-terra-700 sm:inline-flex"
          >
            <Plus className="h-4 w-4" aria-hidden /> Report Issue
          </Link>

          {user ? (
            <>
              <button
                onClick={() => setSearchOpen((v) => !v)}
                className="rounded-lg p-2 text-ink-soft hover:bg-surface-2 md:hidden"
                aria-label="Search issues"
                aria-expanded={searchOpen}
              >
                <Search className="h-5 w-5" />
              </button>
              <Link
                href="/notifications"
                className="relative rounded-lg p-2 text-ink-soft hover:bg-surface-2"
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              >
                <Bell className="h-5 w-5" />
                {!!unreadCount && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-alert px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg p-1 hover:bg-surface-2"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                >
                  <Avatar name={user.name} src={user.profileImage} role={user.role} size="sm" />
                </button>
                {menuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-pop"
                    role="menu"
                  >
                    <div className="border-b border-line px-3 pb-2.5 pt-1.5">
                      <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                      <p className="truncate text-xs text-ink-muted">{user.email}</p>
                      <span className="mt-1.5 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                        {user.role}
                      </span>
                    </div>
                    <MenuLink href={roleHome} icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
                    <MenuLink href="/profile" icon={<User className="h-4 w-4" />} label="Profile & settings" />
                    {user.role === "CITIZEN" && (
                      <MenuLink href="/my-reports" icon={<Map className="h-4 w-4" />} label="My reports" />
                    )}
                    {(user.role === "AUTHORITY" || user.role === "ADMIN") && (
                      <MenuLink href="/authority" icon={<Shield className="h-4 w-4" />} label="Authority desk" />
                    )}
                    {(user.role === "WORKER" || user.role === "ADMIN") && (
                      <MenuLink href="/worker" icon={<Wrench className="h-4 w-4" />} label="Field jobs" />
                    )}
                    {user.role === "ADMIN" && (
                      <>
                        <MenuLink href="/admin/users" icon={<Users className="h-4 w-4" />} label="Manage users" />
                        <MenuLink href="/admin" icon={<Settings className="h-4 w-4" />} label="Admin console" />
                      </>
                    )}
                    <form
                      action="/api/auth/logout"
                      method="post"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await fetch("/api/auth/logout", { method: "POST" });
                        window.location.href = "/";
                      }}
                    >
                      <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-alert hover:bg-alert-soft" role="menuitem">
                        <LogOut className="h-4 w-4" /> Log out
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink">
                Log in
              </Link>
              <Link href="/register" className="hidden h-9 items-center rounded-lg bg-ink px-3.5 text-sm font-semibold text-canvas hover:brightness-125 sm:inline-flex">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
      {searchOpen && (
        <form
          className="border-t border-line bg-surface px-4 py-3 md:hidden"
          onSubmit={(e) => {
            e.preventDefault();
            if (searchValue.trim()) window.location.href = `/issues?q=${encodeURIComponent(searchValue.trim())}`;
            setSearchOpen(false);
          }}
        >
          <input
            type="search"
            autoFocus
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search issues, areas or complaint IDs…"
            aria-label="Search civic issues"
            className="h-11 w-full rounded-lg border border-line bg-canvas px-3.5 text-sm focus:border-terra-400 focus:outline-none"
          />
        </form>
      )}
    </header>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink" role="menuitem">
      {icon} {label}
    </Link>
  );
}
