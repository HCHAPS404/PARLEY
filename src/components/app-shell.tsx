"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  CreditCard,
  FileText,
  Landmark,
  LogOut,
  MessagesSquare,
  MessageSquare,
  Moon,
  Package,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  Users,
  Workflow,
} from "lucide-react";
import { Logo } from "./brand";
import { SpaceSwitcher } from "./space-switcher";
import { usePrefs } from "./preferences";

const NAV_BUYER = [
  { href: "/app", key: "nav.agent", icon: MessagesSquare },
  { href: "/sellers", key: "nav.sellers", icon: Store },
  { href: "/messages", key: "nav.messages", icon: MessageSquare },
  { href: "/analytics", key: "nav.analytics", icon: BarChart3 },
  { href: "/pipeline", key: "nav.pipeline", icon: Workflow },
  { href: "/inbox", key: "nav.inbox", icon: Bell },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

const NAV_SELLER = [
  { href: "/seller", key: "nav.seller", icon: Store, exact: true },
  { href: "/seller/copilot", key: "nav.seller.copilot", icon: Sparkles, ai: true },
  { href: "/seller/inventory", key: "nav.seller.inventory", icon: Boxes },
  { href: "/seller/orders", key: "nav.seller.orders", icon: Package },
  { href: "/seller/customers", key: "nav.seller.customers", icon: Users },
  { href: "/seller/invoices", key: "nav.seller.invoices", icon: FileText },
  { href: "/seller/payments", key: "nav.seller.payments", icon: CreditCard },
  { href: "/messages", key: "nav.messages", icon: MessageSquare },
  { href: "/inbox", key: "nav.inbox", icon: Bell },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

export function AppShell({
  user,
  children,
}: {
  user: { username: string; role: string; persona?: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [inboxCount, setInboxCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);
  const [storePulse, setStorePulse] = useState<{
    profile: { displayName: string; floorRatioPct: number } | null;
    stats?: { pendingShipCount: number; lowStockCount: number };
    campaigns?: { active: boolean; endsAt: string | null }[];
    fetchedAt: number;
  } | null>(null);
  useEffect(() => {
    const load = () => {
      fetch("/api/alerts")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setInboxCount(d.alerts?.length ?? 0))
        .catch(() => {});
      fetch("/api/threads")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) =>
          d && setMsgCount(
            (d.threads as { unread?: number }[] ?? []).reduce((s, t) => s + (t.unread ?? 0), 0),
          ),
        )
        .catch(() => {});
      if (user.persona === "seller") {
        fetch("/api/seller")
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d && setStorePulse({ ...d, fetchedAt: Date.now() }))
          .catch(() => {});
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [user.persona]);
  const { t, lang, setLang, theme, setTheme } = usePrefs();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const darkActive =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      document.documentElement.dataset.theme === "dark");

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-card md:flex">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
          <Logo className="h-7 w-7 text-accent" />
          <div>
            <div className="font-display text-[15px] font-semibold tracking-tight">
              Parley
            </div>
            <div className="text-[11px] text-ink-soft">{t("app.tagline")}</div>
          </div>
        </div>

        {/* Spaces are a buyer-side concept (budgets/orders per context) —
            a seller's store is global, so the switcher stays hidden. */}
        {user.persona !== "seller" && <SpaceSwitcher />}

        <nav className="flex flex-col gap-1 p-3 text-sm">
          {(user.persona === "seller" ? NAV_SELLER : NAV_BUYER).map(({ href, key, icon: Icon, ...item }) => {
            const active =
              "exact" in item && item.exact
                ? pathname === href
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors ${
                  active
                    ? "bg-accent-mist font-medium text-accent-strong"
                    : "text-ink-soft hover:bg-paper hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(key)}
                {"ai" in item && item.ai && (
                  <span className="ml-auto rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-strong">
                    AI
                  </span>
                )}
                {key === "nav.messages" && msgCount > 0 && (
                  <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-paper">
                    {msgCount}
                  </span>
                )}
                {key === "nav.inbox" && inboxCount > 0 && (
                  <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-paper">
                    {inboxCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Store pulse — keeps the seller sidebar alive between nav and footer */}
        {user.persona === "seller" && storePulse?.profile && (
          <div className="mx-3 mt-2 rounded-xl border border-line bg-paper p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-ok/60" />
                <span className="h-2 w-2 rounded-full bg-ok" />
              </span>
              {t("sidebar.agentLive")}
            </div>
            <div className="mt-1.5 truncate text-[13px] font-semibold">
              {storePulse.profile.displayName}
            </div>
            <div className="mt-2 space-y-1 text-[11px] text-ink-soft">
              <div className="flex justify-between">
                <span>{t("sidebar.floor")}</span>
                <span className="font-semibold text-ink">{storePulse.profile.floorRatioPct}%</span>
              </div>
              <div className="flex justify-between">
                <span>{t("sidebar.liveCampaigns")}</span>
                <span className="font-semibold text-ink">
                  {(storePulse.campaigns ?? []).filter(
                    (c) => c.active && (!c.endsAt || new Date(c.endsAt).getTime() > storePulse.fetchedAt),
                  ).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t("sidebar.toShip")}</span>
                <span className="font-semibold text-ink">{storePulse.stats?.pendingShipCount ?? 0}</span>
              </div>
              {(storePulse.stats?.lowStockCount ?? 0) > 0 && (
                <div className="mt-1 rounded-md bg-warn/10 px-2 py-1 text-[10px] font-medium text-warn">
                  {t("sidebar.lowStock", { n: String(storePulse.stats!.lowStockCount) })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-auto space-y-3 border-t border-line p-4">
          <div className="space-y-2 text-[11px] text-ink-soft">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              {t("sidebar.escrow")}
            </div>
            <div className="flex items-center gap-2">
              <Landmark className="h-3.5 w-3.5 text-accent" />
              {t("sidebar.sandbox")}
            </div>
            <div className="flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-accent" />
              {t("sidebar.audit")}
            </div>
          </div>

          {/* Quick prefs — the real controls live in /settings */}
          <div className="flex items-center justify-between gap-2 border-t border-line/60 pt-3">
            <div className="flex rounded-md border border-line p-0.5 text-[10px] font-medium">
              {(["en", "es"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`rounded px-1.5 py-0.5 uppercase transition-colors ${
                    lang === l
                      ? "bg-accent-mist text-accent-strong"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              onClick={() => setTheme(darkActive ? "light" : "dark")}
              className="rounded-md border border-line p-1.5 text-ink-soft transition-colors hover:text-ink"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {darkActive ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={logout}
              className="rounded-md border border-line p-1.5 text-ink-soft transition-colors hover:text-danger"
              aria-label={t("nav.signOut")}
              title={t("nav.signOut")}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>

          <Link
            href="/settings"
            className="flex items-center gap-2.5 rounded-lg border border-line bg-paper px-2.5 py-2 transition-colors hover:border-accent/40"
            title={t("settings.profile")}
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-mist font-display text-[11px] font-semibold text-accent-strong">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium">
                {user.username}
              </div>
              <div className="text-[10px] text-ink-soft">
                {t(
                  user.role === "admin"
                    ? "common.admin"
                    : user.role === "demo"
                      ? "common.demo"
                      : "common.user",
                )}
              </div>
            </div>
            <Settings className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
          </Link>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col pb-14 md:pb-0">{children}</main>

      {/* Mobile bottom nav — the sidebar is desktop-only, so small screens
          get the same destinations as a fixed icon bar. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line bg-card/95 backdrop-blur md:hidden">
        {(user.persona === "seller" ? NAV_SELLER : NAV_BUYER).map(({ href, key, icon: Icon, ...item }) => {
          const active =
            "exact" in item && item.exact
              ? pathname === href
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={t(key)}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[9px] font-medium transition-colors ${
                active ? "text-accent-strong" : "text-ink-soft"
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              <span className="max-w-full truncate px-0.5">{t(key)}</span>
              {key === "nav.messages" && msgCount > 0 && (
                <span className="absolute right-2 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[8px] font-bold text-paper">
                  {msgCount}
                </span>
              )}
              {key === "nav.inbox" && inboxCount > 0 && (
                <span className="absolute right-2 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[8px] font-bold text-paper">
                  {inboxCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
