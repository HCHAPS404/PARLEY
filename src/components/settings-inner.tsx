"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Globe,
  Loader2,
  Lock,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  User,
} from "lucide-react";
import { usePrefs, type Theme } from "./preferences";

interface Policy {
  id: string;
  name: string;
  maxPerTxCents: number;
  dailyCapCents: number;
  monthlyCapCents: number;
  autonomousLimitCents: number;
  allowedVendors: string[] | null;
  active: boolean;
}

const toDollars = (cents: number) => (cents / 100).toString();
const toCents = (dollars: string) => Math.round(parseFloat(dollars || "0") * 100);

export function SettingsInner({
  user,
}: {
  user: { username: string; email: string; role: string };
}) {
  const { t, lang, setLang, theme, setTheme } = usePrefs();
  const router = useRouter();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    maxPerTx: "",
    daily: "",
    monthly: "",
    autonomous: "",
    vendors: "",
    active: true,
  });

  useEffect(() => {
    fetch("/api/policy")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.policy) return;
        setPolicy(d.policy);
        setCanEdit(d.canEdit);
        setForm({
          maxPerTx: toDollars(d.policy.maxPerTxCents),
          daily: toDollars(d.policy.dailyCapCents),
          monthly: toDollars(d.policy.monthlyCapCents),
          autonomous: toDollars(d.policy.autonomousLimitCents),
          vendors: (d.policy.allowedVendors ?? []).join(", "),
          active: d.policy.active,
        });
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/policy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        maxPerTxCents: toCents(form.maxPerTx),
        dailyCapCents: toCents(form.daily),
        monthlyCapCents: toCents(form.monthly),
        autonomousLimitCents: toCents(form.autonomous),
        allowedVendors: form.vendors
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        active: form.active,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json();
      if (d?.policy) setPolicy(d.policy);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const field = (
    label: Parameters<typeof t>[0],
    key: keyof typeof form,
    hint?: string,
  ) => (
    <label key={key} className="block">
      <span className="text-[12px] font-medium text-ink">{t(label)}</span>
      <input
        type={key === "vendors" ? "text" : "number"}
        min="0"
        step="0.01"
        disabled={!canEdit}
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent disabled:opacity-50"
      />
      {hint && <span className="mt-1 block text-[11px] text-ink-soft">{hint}</span>}
    </label>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t("settings.title")}
        </h1>
        <p className="mt-1 text-[13px] text-ink-soft">{t("settings.subtitle")}</p>

        <Section icon={<User className="h-4 w-4" />} title={t("settings.profile")}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-accent-mist font-display text-[15px] font-semibold text-accent-strong">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium">{user.username}</div>
              <div className="truncate text-[12px] text-ink-soft">{user.email}</div>
            </div>
            <span
              className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-medium ${
                user.role === "admin"
                  ? "bg-accent-mist text-accent-strong"
                  : "bg-paper text-ink-soft"
              }`}
            >
              {t(user.role === "admin" ? "common.admin" : "common.demo")}
            </span>
          </div>
        </Section>

        <Section icon={<Globe className="h-4 w-4" />} title={t("settings.language")}>
          <div className="flex rounded-lg border border-line p-1">
            {(["en", "es"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                  lang === l
                    ? "bg-accent-mist text-accent-strong"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {l === "en" ? "English" : "Español"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-soft">{t("settings.language.note")}</p>
        </Section>

        <Section icon={<Moon className="h-4 w-4" />} title={t("settings.appearance")}>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { v: "light", icon: Sun, label: t("settings.appearance.light") },
                { v: "dark", icon: Moon, label: t("settings.appearance.dark") },
                { v: "system", icon: Check, label: t("settings.appearance.system") },
              ] satisfies { v: Theme; icon: typeof Sun; label: string }[]
            ).map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                onClick={() => setTheme(v)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-[12px] font-medium transition-colors ${
                  theme === v
                    ? "border-accent bg-accent-mist text-accent-strong"
                    : "border-line text-ink-soft hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section
          icon={<ShieldCheck className="h-4 w-4" />}
          title={t("settings.policy")}
        >
          <p className="mb-4 text-[12px] text-ink-soft">{t("settings.policy.note")}</p>
          {!canEdit && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-[12px] text-warn">
              <Lock className="h-3.5 w-3.5" />
              {t("settings.policy.adminOnly")}
            </div>
          )}
          {policy ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {field("settings.policy.maxPerTx", "maxPerTx")}
                {field("settings.policy.autonomous", "autonomous", t("settings.policy.autonomousHint"))}
                {field("settings.policy.daily", "daily")}
                {field("settings.policy.monthly", "monthly")}
              </div>
              {field("settings.policy.vendors", "vendors", t("settings.policy.vendorsHint"))}
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={form.active}
                  disabled={!canEdit}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                {t("settings.policy.active")}
              </label>
              {canEdit && (
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : saved ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : null}
                  {saving ? t("settings.saving") : saved ? t("settings.saved") : t("settings.save")}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[13px] text-ink-soft">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("common.loading")}
            </div>
          )}
        </Section>

        <Section icon={<LogOut className="h-4 w-4" />} title={t("settings.session")}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink-soft">{t("settings.session.signOut")}</span>
            <button
              onClick={logout}
              className="rounded-lg border border-danger/30 px-4 py-2 text-[13px] font-medium text-danger transition-colors hover:bg-danger-soft"
            >
              {t("settings.session.signOutBtn")}
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 rounded-xl border border-line bg-card p-5">
      <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-ink">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}
