"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, Plus, Search, User } from "lucide-react";
import { cn } from "@/lib/utils/format";

/**
 * Mobile bottom navigation (spec §7) with a prominent center Report action.
 * Hidden on sm+ screens.
 */
export function MobileNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: isAuthenticated ? "/dashboard" : "/", icon: Home, label: "Home" },
    { href: "/issues", icon: Search, label: "Explore" },
    { href: "/report", icon: Plus, label: "Report", primary: true },
    { href: "/map", icon: Map, label: "Map" },
    { href: isAuthenticated ? "/profile" : "/login", icon: User, label: isAuthenticated ? "Profile" : "Login" },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[950] border-t border-line bg-surface/95 backdrop-blur sm:hidden"
      aria-label="Mobile navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          if (item.primary) {
            return (
              <li key={item.href} className="flex flex-1 justify-center">
                <Link
                  href={item.href}
                  className="-mt-6 flex h-14 w-14 flex-col items-center justify-center rounded-full bg-terra-600 text-white shadow-pop active:bg-terra-700"
                  aria-label="Report an issue"
                >
                  <Plus className="h-6 w-6" />
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                  active ? "text-terra-600" : "text-ink-muted"
                )}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
