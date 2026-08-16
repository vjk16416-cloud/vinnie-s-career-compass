import { Link, useRouterState } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  FileText,
  Gauge,
  Home,
  Radar,
  Settings as SettingsIcon,
  ShieldCheck,
  UserRound,
  Plus,
} from "lucide-react";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/auth/account-menu";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { to: "/job-scan", label: "Job Scan", icon: Radar },
  { to: "/cvs", label: "CVs", icon: FileText },
  { to: "/profile", label: "Career Profile", icon: UserRound },
  { to: "/evidence", label: "Evidence", icon: ShieldCheck },
  { to: "/market", label: "Job Market Intelligence", icon: Gauge },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

const MOBILE_NAV = NAV_ITEMS.filter((n) =>
  ["/", "/applications", "/job-scan", "/evidence", "/cvs"].includes(n.to),
);

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            CO
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">CareerOS</p>
            <p className="truncate text-[11px] text-muted-foreground">Vinnie Jegathees</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-2" aria-label="Main">
          {NAV_ITEMS.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border px-3 py-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Data source: <span className="text-foreground">Local seeded data</span>
            <br />
            No external systems connected.
          </p>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:flex sm:justify-between md:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              <AccountMenu />
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-6 lg:pb-12">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-sidebar/95 backdrop-blur lg:hidden"
        aria-label="Primary mobile"
      >
        <div className="grid grid-cols-6">
          {MOBILE_NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                <span className="truncate">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
          <Link
            to="/job-scan"
            aria-label="Quick add job"
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] text-primary-foreground"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-muted-foreground">Add</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
