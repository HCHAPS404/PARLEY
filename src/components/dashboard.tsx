"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Banknote,
  Bell,
  PackageCheck,
  PiggyBank,
  ShieldCheck,
  Store,
  TrendingUp,
} from "lucide-react";
import { DataGrid } from "./data-grid";
import { usePrefs } from "./preferences";
import type { I18nKey } from "@/lib/i18n";

type Row = Record<string, unknown>;
type Sources = { id: string; data: Row[] }[];

const STATUS: Record<string, { label: string; pill: string; bar: string }> = {
  created: { label: "Created", pill: "bg-card text-ink-soft border-line", bar: "bg-line" },
  approved: { label: "Approved", pill: "bg-warn-soft text-warn border-warn/30", bar: "bg-warn" },
  authorized: { label: "In escrow", pill: "bg-accent-soft text-accent-strong border-accent/30", bar: "bg-accent" },
  unpaid: { label: "Awaiting approval", pill: "bg-warn-soft text-warn border-warn/30", bar: "bg-warn" },
  captured: { label: "Released", pill: "bg-ok-soft text-ok border-ok/30", bar: "bg-ok" },
  voided: { label: "Voided", pill: "bg-card text-ink-soft border-line", bar: "bg-ink-soft/40" },
  cancelled: { label: "Cancelled", pill: "bg-card text-ink-soft border-line", bar: "bg-ink-soft/40" },
  expired: { label: "Expired", pill: "bg-danger-soft text-danger border-danger/30", bar: "bg-danger" },
};
const FALLBACK = STATUS.created;

const usd = (v: unknown) =>
  v == null ? "—" : `$${Number(v).toFixed(2)}`;

function relTime(iso: string | undefined, now: number): string {
  if (!iso) return "";
  const mins = Math.round((now - Date.parse(iso)) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

export function Dashboard() {
  const { t } = usePrefs();
  const [sources, setSources] = useState<Sources | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics-data")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((d) => {
        setNow(Date.now());
        setSources(d.sources);
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const data = useMemo(() => {
    const get = (id: string): Row[] =>
      sources?.find((s) => s.id === id)?.data ?? [];
    const orders = get("orders");
    const alerts = get("alerts");
    const vendors = get("vendor_scores");
    const audit = get("agent_activity");
    const savings = get("savings")[0] ?? {};
    const priceRows = get("price_points");

    // Price trace — group points per product title, oldest → newest.
    const traceMap = new Map<string, { title: string; vendor: string | null; pts: { c: number; k: string; ts: number }[] }>();
    for (const p of priceRows) {
      const key = String(p.title);
      const g = traceMap.get(key) ?? { title: key, vendor: (p.vendor as string | null) ?? null, pts: [] };
      g.pts.push({ c: Number(p.cents), k: String(p.kind), ts: Date.parse(String(p.created_at)) });
      traceMap.set(key, g);
    }
    const traces = [...traceMap.values()]
      .map((g) => ({ ...g, pts: g.pts.sort((a, b) => a.ts - b.ts) }))
      .filter((g) => g.pts.length >= 2)
      .sort((a, b) => b.pts.length - a.pts.length)
      .slice(0, 4);

    const heldCents = orders
      .filter((o) => ["authorized", "approved"].includes(String(o.status)))
      .reduce((s, o) => s + (Number(o.amount_usd) || 0), 0);
    const captured = orders
      .filter((o) => o.status === "captured")
      .reduce((s, o) => s + (Number(o.amount_usd) || 0), 0);
    const openAlerts = alerts.filter((a) =>
      ["open", "new", "unresolved"].includes(String(a.status)),
    );

    const byStatus = new Map<string, number>();
    orders.forEach((o) =>
      byStatus.set(String(o.status), (byStatus.get(String(o.status)) ?? 0) + 1),
    );

    const days: { label: string; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      days.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        total: 0,
      });
    }
    orders.forEach((o) => {
      if (!o.created_at) return;
      const idx = Math.floor(
        (now - Date.parse(String(o.created_at))) / 86400000,
      );
      if (idx >= 0 && idx < 14)
        days[13 - idx].total += Number(o.amount_usd) || 0;
    });
    const maxDay = Math.max(1, ...days.map((d) => d.total));

    return {
      orders,
      alerts,
      vendors: [...vendors].sort(
        (a, b) => Number(b.score) - Number(a.score),
      ),
      audit: audit.slice(0, 8),
      openAlerts,
      byStatus,
      traces,
      kpis: {
        orders: orders.length,
        held: heldCents,
        captured,
        saved: Number(savings.saved_usd) || 0,
        alerts: openAlerts.length,
      },
      days,
      maxDay,
    };
  }, [sources, now]);

  if (error)
    return (
      <div className="grid h-full place-items-center text-sm text-danger">
        {error}
      </div>
    );
  if (!sources)
    return (
      <div className="grid h-full place-items-center text-sm text-ink-soft">
        Loading procurement data…
      </div>
    );

  const { kpis, byStatus, days, maxDay, vendors, audit, openAlerts, orders, traces } =
    data;
  const totalOrders = Math.max(1, kpis.orders);

  const kpisRow: { icon: typeof Banknote; label: I18nKey; value: string; tone: string }[] = [
    { icon: PackageCheck, label: "dash.kpi.orders", value: String(kpis.orders), tone: "text-ink" },
    { icon: ShieldCheck, label: "dash.kpi.held", value: usd(kpis.held), tone: "text-accent-strong" },
    { icon: Banknote, label: "dash.kpi.captured", value: usd(kpis.captured), tone: "text-ok" },
    { icon: PiggyBank, label: "dash.kpi.saved", value: usd(kpis.saved), tone: "text-ok" },
    { icon: Bell, label: "dash.kpi.alerts", value: String(kpis.alerts), tone: kpis.alerts ? "text-danger" : "text-ink" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 px-5 py-5">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {kpisRow.map(({ icon: Icon, label, value, tone }) => (
            <div
              key={label}
              className="rounded-xl border border-line bg-card p-4"
            >
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                <Icon className="h-3.5 w-3.5" />
                {t(label)}
              </div>
              <div className={`font-display mt-1.5 text-2xl font-semibold tracking-tight ${tone}`}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* Status breakdown */}
          <section className="rounded-xl border border-line bg-card p-4">
            <h2 className="text-[13px] font-semibold">{t("dash.status.title")}</h2>
            <p className="text-[11px] text-ink-soft">{t("dash.status.sub")}</p>
            {orders.length === 0 ? (
              <EmptyDash t={t} />
            ) : (
              <>
                <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-paper">
                  {[...byStatus.entries()].map(([st, n]) => (
                    <div
                      key={st}
                      className={(STATUS[st] ?? FALLBACK).bar}
                      style={{ width: `${(n / totalOrders) * 100}%` }}
                      title={`${(STATUS[st] ?? FALLBACK).label}: ${n}`}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[...byStatus.entries()].map(([st, n]) => {
                    const meta = STATUS[st] ?? FALLBACK;
                    return (
                      <span
                        key={st}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.pill}`}
                      >
                        {meta.label}
                        <span className="opacity-60">{n}</span>
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {/* Spend chart */}
          <section className="rounded-xl border border-line bg-card p-4">
            <h2 className="text-[13px] font-semibold">{t("dash.spend.title")}</h2>
            <p className="text-[11px] text-ink-soft">{t("dash.spend.sub")}</p>
            <div className="mt-4 flex h-28 items-end gap-1">
              {days.map((d, i) => (
                <div
                  key={i}
                  className="group relative flex-1"
                  title={`${d.label}: ${usd(d.total)}`}
                >
                  <div
                    className="w-full rounded-t-sm bg-accent/70 transition-colors group-hover:bg-accent"
                    style={{
                      height: `${Math.max(d.total ? 6 : 2, (d.total / maxDay) * 100)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-ink-soft">
              <span>{days[0]?.label}</span>
              <span>{days[13]?.label}</span>
            </div>
          </section>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* Vendors */}
          <section className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-ink-soft" />
              <h2 className="text-[13px] font-semibold">{t("dash.vendors.title")}</h2>
            </div>
            <p className="text-[11px] text-ink-soft">{t("dash.vendors.sub")}</p>
            <div className="mt-3 space-y-1.5">
              {vendors.slice(0, 6).map((v) => {
                const score = Number(v.score);
                const tone =
                  score >= 75 ? "bg-ok-soft text-ok" : score >= 50 ? "bg-warn-soft text-warn" : "bg-danger-soft text-danger";
                return (
                  <div key={String(v.domain)} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                    <span className={`grid h-8 w-9 place-items-center rounded-md text-[12px] font-semibold ${tone}`}>
                      {score}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {String(v.domain)}
                    </span>
                    <span className="text-[11px] text-ink-soft">
                      {Number(v.orders_count)} {t("dash.vendors.orders")} · {Number(v.on_time_count)} {t("dash.vendors.onTime")}
                    </span>
                  </div>
                );
              })}
              {vendors.length === 0 && <EmptyDash t={t} />}
            </div>
          </section>

          {/* Alerts */}
          <section className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-ink-soft" />
              <h2 className="text-[13px] font-semibold">{t("dash.alerts.title")}</h2>
            </div>
            <div className="mt-3 space-y-1.5">
              {openAlerts.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-ok-soft/60 px-3 py-2.5 text-[12px] text-ok">
                  <ShieldCheck className="h-4 w-4" />
                  {t("dash.alerts.clear")}
                </div>
              ) : (
                openAlerts.slice(0, 6).map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 rounded-lg border border-warn/25 bg-warn-soft/60 px-3 py-2 text-[12px]"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {String(a.kind).replaceAll("_", " ")}
                    </span>
                    <span className="text-[10px] text-ink-soft">
                      {relTime(String(a.created_at), now)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Price trace — what we actually paid per product over time */}
        {traces.length > 0 && (
          <section className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-ink-soft" />
              <h2 className="text-[13px] font-semibold">{t("dash.trace.title")}</h2>
            </div>
            <p className="text-[11px] text-ink-soft">{t("dash.trace.sub")}</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {traces.map((g) => {
                const paid = g.pts.filter((p) => p.k === "paid");
                const list = g.pts.filter((p) => p.k === "list");
                const last = paid.at(-1)?.c ?? g.pts.at(-1)!.c;
                const first = paid[0]?.c ?? g.pts[0].c;
                const delta = last - first;
                const lo = Math.min(...g.pts.map((p) => p.c));
                const hi = Math.max(...g.pts.map((p) => p.c));
                const span = Math.max(1, hi - lo);
                const W = 100, H = 34;
                const xy = g.pts.map((p, i) => {
                  const x = (i / Math.max(1, g.pts.length - 1)) * W;
                  const y = H - 3 - ((p.c - lo) / span) * (H - 8);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                });
                return (
                  <div key={g.title} className="rounded-lg border border-line/60 bg-paper px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-[12px] font-medium">{g.title}</span>
                      <span className="shrink-0 text-[11px] text-ink-soft">{g.vendor}</span>
                    </div>
                    <div className="mt-1.5 flex items-end justify-between gap-3">
                      <svg viewBox={`0 0 ${W} ${H}`} className="h-9 min-w-0 flex-1" preserveAspectRatio="none">
                        {list.length > 0 && (
                          <polyline
                            points={g.pts.map((p, i) => p.k === "list" ? xy[i] : null).filter(Boolean).join(" ")}
                            fill="none" strokeWidth="1" strokeDasharray="3 2"
                            className="stroke-ink-soft/50"
                          />
                        )}
                        <polyline points={xy.join(" ")} fill="none" strokeWidth="1.5" className="stroke-accent" />
                        {g.pts.map((p, i) => (
                          <circle key={i} cx={xy[i].split(",")[0]} cy={xy[i].split(",")[1]} r="1.6"
                            className={p.k === "paid" ? "fill-accent-strong" : "fill-ink-soft/60"} />
                        ))}
                      </svg>
                      <div className="shrink-0 text-right">
                        <div className="font-display text-[15px] font-semibold">{usd(last / 100)}</div>
                        {paid.length > 0 && delta !== 0 && (
                          <div className={`text-[10.5px] font-medium ${delta < 0 ? "text-ok" : "text-warn"}`}>
                            {delta < 0 ? "▼" : "▲"} {usd(Math.abs(delta) / 100)} {t("dash.trace.trend")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Activity feed */}
        <section className="rounded-xl border border-line bg-card p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-ink-soft" />
            <h2 className="text-[13px] font-semibold">{t("dash.activity.title")}</h2>
          </div>
          <p className="text-[11px] text-ink-soft">{t("dash.activity.sub")}</p>
          <div className="mt-3 divide-y divide-line/50">
            {audit.map((a, i) => (
              <div key={i} className="flex items-baseline gap-3 py-2">
                <span className="w-8 shrink-0 text-right font-mono text-[10px] text-ink-soft">
                  {relTime(String(a.ts), now)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  <span className="font-medium">{String(a.action)}</span>
                  {a.rationale ? (
                    <span className="text-ink-soft"> — {String(a.rationale).slice(0, 90)}</span>
                  ) : null}
                </span>
                <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                  {String(a.actor)}
                </span>
              </div>
            ))}
            {audit.length === 0 && <EmptyDash t={t} />}
          </div>
        </section>

        {/* Orders table */}
        <section className="rounded-xl border border-line bg-card p-4">
          <h2 className="text-[13px] font-semibold">{t("dash.orders.title")}</h2>
          <div className="mt-3 h-80">
            <DataGrid
              rowData={orders}
              columnDefs={[
                {
                  field: "status",
                  headerName: t("dash.col.status"),
                  width: 130,
                  cellRenderer: (p: { value: string }) => {
                    const meta = STATUS[p.value] ?? FALLBACK;
                    return (
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.pill}`}>
                        {meta.label}
                      </span>
                    );
                  },
                },
                { field: "title", headerName: t("dash.col.title"), flex: 2, minWidth: 200 },
                { field: "vendor", headerName: t("dash.col.vendor"), flex: 1, minWidth: 130 },
                {
                  field: "amount_usd",
                  headerName: t("dash.col.amount"),
                  width: 110,
                  type: "numericColumn",
                  valueFormatter: (p) => usd(p.value),
                },
                {
                  field: "agreed_usd",
                  headerName: t("dash.col.agreed"),
                  width: 110,
                  type: "numericColumn",
                  valueFormatter: (p) => usd(p.value),
                },
                {
                  field: "negotiated",
                  headerName: t("dash.col.negotiated"),
                  width: 110,
                  cellRenderer: (p: { value: boolean }) =>
                    p.value ? "✓" : "—",
                },
                {
                  field: "created_at",
                  headerName: t("dash.col.created"),
                  width: 120,
                  valueFormatter: (p) =>
                    p.value
                      ? new Date(String(p.value)).toLocaleDateString()
                      : "—",
                },
              ]}
              defaultColDef={{ sortable: true, resizable: true, filter: true }}
              animateRows
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function EmptyDash({ t }: { t: (k: I18nKey) => string }) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">
      {t("dash.empty")}
    </div>
  );
}
