"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Globe,
  Layers,
  Store,
  Loader2,
  Lock,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  User,
} from "lucide-react";
import { usePrefs, type Theme } from "./preferences";
import { SpaceDot, SPACE_COLORS, type SpaceInfo } from "./space-switcher";
import type { I18nKey } from "@/lib/i18n";

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
  const [spaceName, setSpaceName] = useState("");
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
        if (d.spaceName) setSpaceName(d.spaceName);
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

        <Section icon={<Layers className="h-4 w-4" />} title={t("space.settings")}>
          <SpacesPanel t={t} />
        </Section>

        <Section icon={<Store className="h-4 w-4" />} title={t("sell.settings")}>
          <SellPanel t={t} />
        </Section>

        <Section
          icon={<ShieldCheck className="h-4 w-4" />}
          title={t("settings.policy")}
        >
          <p className="mb-4 text-[12px] text-ink-soft">
            {t("settings.policy.note")}{" "}
            <span className="font-medium text-ink">
              {t("space.policyScope")}
              {spaceName ? ` (${spaceName})` : ""}
            </span>
          </p>
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

function SpacesPanel({ t }: { t: (k: I18nKey) => string }) {
  const router = useRouter();
  const [spaces, setSpaces] = useState<SpaceInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");

  const load = () =>
    fetch("/api/spaces")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setSpaces(d.spaces);
        setActiveId(d.activeId);
      });

  useEffect(() => {
    load();
  }, []);

  const switchTo = async (id: string) => {
    if (id === activeId) return;
    await fetch("/api/spaces/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setActiveId(id);
    router.refresh();
  };

  const rename = async (id: string) => {
    const name = editName.trim();
    if (!name) return setEditId(null);
    await fetch("/api/spaces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    setEditId(null);
    load();
  };

  const recolor = async (id: string, color: string) => {
    await fetch("/api/spaces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, color }),
    });
    load();
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    const r = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) return;
    const { space } = await r.json();
    setNewName("");
    await load();
    await switchTo(space.id);
  };

  return (
    <div>
      <p className="mb-4 text-[12px] text-ink-soft">{t("space.settings.note")}</p>
      <div className="space-y-2">
        {spaces.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2.5"
          >
            <SpaceDot color={s.color} />
            {editId === s.id ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") rename(s.id);
                  if (e.key === "Escape") setEditId(null);
                }}
                onBlur={() => rename(s.id)}
                maxLength={40}
                className="min-w-0 flex-1 rounded border border-line bg-paper px-2 py-1 text-[13px] outline-none focus:border-accent"
              />
            ) : (
              <button
                onClick={() => {
                  setEditId(s.id);
                  setEditName(s.name);
                }}
                className="min-w-0 flex-1 truncate text-left text-[13px] font-medium"
                title={t("space.rename")}
              >
                {s.name}
              </button>
            )}
            <div className="flex shrink-0 items-center gap-1">
              {Object.entries(SPACE_COLORS).map(([key, hex]) => (
                <button
                  key={key}
                  onClick={() => recolor(s.id, key)}
                  className={`h-3.5 w-3.5 rounded-full transition-transform hover:scale-125 ${
                    s.color === key ? "ring-2 ring-offset-1 ring-[var(--color-line)]" : ""
                  }`}
                  style={{ background: hex }}
                  aria-label={`${t("space.color")} ${key}`}
                />
              ))}
            </div>
            {s.id === activeId ? (
              <span className="shrink-0 rounded-full bg-accent-mist px-2 py-0.5 text-[10px] font-medium text-accent-strong">
                {t("space.active")}
              </span>
            ) : (
              <button
                onClick={() => switchTo(s.id)}
                className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent-strong"
              >
                {t("space.switch")}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder={t("space.namePlaceholder")}
          maxLength={40}
          className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-[13px] outline-none placeholder:text-ink-soft/60 focus:border-accent"
        />
        <button
          onClick={create}
          disabled={!newName.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
        >
          {t("space.create")}
        </button>
      </div>
    </div>
  );
}

function SellPanel({ t }: { t: (k: I18nKey) => string }) {
  const [profile, setProfile] = useState<{ id: string; displayName: string; floorRatioPct: number; style: string } | null>(null);
  const [products, setProducts] = useState<{ id: string; title: string; priceCents: number; stock: number }[]>([]);
  const [salesCount, setSalesCount] = useState(0);
  const [name, setName] = useState("");
  const [floor, setFloor] = useState("85");
  const [style, setStyle] = useState("balanced");
  const [pTitle, setPTitle] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/seller")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setProfile(d.profile);
        setProducts(d.products);
        setSalesCount(d.sales.length);
        if (d.profile) {
          setName(d.profile.displayName);
          setFloor(String(d.profile.floorRatioPct));
          setStyle(d.profile.style);
        }
      });
  useEffect(() => { load(); }, []);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    await fetch("/api/seller", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    load();
  };

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-ink-soft">{t("sell.note")}</p>
      <div className="grid grid-cols-3 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("sell.name")}
          className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
        />
        <input
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          type="number" min={50} max={95}
          title={t("sell.floor")}
          className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
        />
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
        >
          <option value="aggressive">{t("sell.aggressive")}</option>
          <option value="balanced">{t("sell.balanced")}</option>
          <option value="conservative">{t("sell.conservative")}</option>
        </select>
      </div>
      <button
        onClick={() => post({ action: "profile", displayName: name, floorRatioPct: Number(floor), style })}
        disabled={busy || !name.trim()}
        className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-strong disabled:opacity-50"
      >
        {profile ? t("sell.update") : t("sell.deploy")}
      </button>
      {profile && (
        <>
          <div className="flex items-center justify-between border-t border-line/60 pt-3 text-[12px]">
            <span className="text-ink-soft">{t("sell.catalog")}</span>
            <span className="font-medium text-accent">{salesCount} {t("sell.sales")}</span>
          </div>
          <div className="flex gap-2">
            <input
              value={pTitle}
              onChange={(e) => setPTitle(e.target.value)}
              placeholder={t("sell.productName")}
              className="flex-1 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
            />
            <input
              value={pPrice}
              onChange={(e) => setPPrice(e.target.value)}
              type="number" min={1} step="0.01" placeholder="$"
              className="w-20 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
            />
            <button
              onClick={() => { post({ action: "addProduct", title: pTitle, priceUsd: Number(pPrice) }); setPTitle(""); setPPrice(""); }}
              disabled={busy || !pTitle.trim() || !pPrice}
              className="rounded-md border border-line px-3 py-1.5 text-[12px] font-medium hover:text-ink disabled:opacity-50"
            >
              {t("sell.add")}
            </button>
          </div>
          {products.length > 0 && (
            <ul className="space-y-1.5">
              {products.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-md border border-line bg-paper px-3 py-1.5 text-[12px]">
                  <span className="truncate">{p.title}</span>
                  <span className="ml-3 shrink-0 font-medium">${(p.priceCents / 100).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
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
