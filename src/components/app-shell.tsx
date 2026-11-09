"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Landmark,
  LogOut,
  MessagesSquare,
  Moon,
  Radio,
  Settings,
  ShieldCheck,
  Sun,
  Workflow,
} from "lucide-react";
import { Logo } from "./brand";
import { SpaceSwitcher } from "./space-switcher";
import { usePrefs } from "./preferences";

const NAV = [
  { href: "/app", key: "nav.agent", icon: MessagesSquare },
  { href: "/analytics", key: "nav.analytics", icon: BarChart3 },
  { href: "/pipeline", key: "nav.pipeline", icon: Workflow },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

export function AppShell({
  user,
  children,
}: {
  user: { username: string; role: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
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

        <SpaceSwitcher />

        <nav className="flex flex-col gap-1 p-3 text-sm">
          {NAV.map(({ href, key, icon: Icon }) => {
            const active = pathname.startsWith(href);
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
              </Link>
            );
          })}
        </nav>

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

          <div
            className={`rounded-full px-2.5 py-1 text-center text-[10px] font-medium ${
              user.role === "admin"
                ? "bg-accent-mist text-accent-strong"
                : "bg-paper text-ink-soft"
            }`}
          >
            {user.username} · {t(user.role === "admin" ? "common.admin" : "common.demo")}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
