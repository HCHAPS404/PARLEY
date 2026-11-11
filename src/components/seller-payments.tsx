"use client";

import { useEffect, useState } from "react";
import { FileText, RefreshCw, Send, CreditCard, AlertTriangle, Plus } from "lucide-react";
import { usePrefs } from "./preferences";

/** PayPal REST shapes are loose — normalize defensively and never trust a field. */
type AnyObj = Record<string, unknown>;
const arr = (v: unknown): AnyObj[] => (Array.isArray(v) ? (v as AnyObj[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): string => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

interface PaymentsData {
  invoices?: unknown;
  transactions?: unknown;
  disputes?: unknown;
  errors?: Record<string, string>;
}

const fetchPayments = () =>
  fetch("/api/seller-payments").then((r) =>
    r.ok ? (r.json() as Promise<PaymentsData>) : null,
  );

function usePayments() {
  const [data, setData] = useState<PaymentsData | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => {
    setBusy(true);
    fetchPayments()
      .then((d) => d && setData(d))
      .finally(() => setBusy(false));
  };
  useEffect(() => {
    fetchPayments().then((d) => d && setData(d));
  }, []);
  return { data, busy, load };
}

function ErrorNote({ msg }: { msg?: string }) {
  const { t } = usePrefs();
  if (!msg) return null;
  return (
    <div className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-[11px] text-warn">
      {t("pay.sandboxErr")}: {msg}
    </div>
  );
}

/** Invoices — list, resend drafts, and issue new ones. */
export function SellerInvoices() {
  const { t } = usePrefs();
  const { data, busy, load } = usePayments();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const invoices = arr((data?.invoices as AnyObj)?.invoices ?? (data?.invoices as AnyObj)?.items);
  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/seller-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; invoiceId?: string };
    if (!r.ok) { setNotice(d.error ?? t("common.error")); return; }
    setNotice(null);
    load();
    return d;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-ink-soft">{t("pay.invoicesSub")}</p>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={busy}
            className="rounded-md border border-line p-2 text-ink-soft hover:text-ink disabled:opacity-50"
            title={t("pay.refresh")}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-paper hover:bg-accent-strong"
          >
            <Plus className="h-3.5 w-3.5" /> {t("pay.newInvoice")}
          </button>
        </div>
      </div>
      <ErrorNote msg={data?.errors?.invoices} />
      {notice && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">{notice}</div>
      )}
      {showForm && (
        <div className="space-y-2 rounded-xl border border-line bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{t("pay.newInvoice")}</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("pay.buyerEmail")}
              type="email"
              className="rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("pay.itemTitle")}
              className="rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="$ 0.00"
              type="number" min={0.01} step="0.01"
              className="rounded-md border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={async () => {
              const d = await post({ action: "createInvoice", email, itemTitle: title, amountUsd: Number(amount) });
              if (d?.ok) {
                setEmail(""); setTitle(""); setAmount(""); setShowForm(false);
                setNotice(t("pay.invoiceSent"));
              }
            }}
            disabled={!email.includes("@") || !title.trim() || !amount}
            className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-paper disabled:opacity-50"
          >
            {t("pay.createSend")}
          </button>
        </div>
      )}
      <div className="rounded-xl border border-line bg-card">
        {!data ? (
          <div className="p-6 text-center text-[12px] text-ink-soft">{t("pay.loading")}</div>
        ) : invoices.length === 0 ? (
          <div className="p-6 text-center">
            <FileText className="mx-auto h-6 w-6 text-ink-soft/50" />
            <p className="mt-2 text-[12px] text-ink-soft">{t("pay.noInvoices")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-line/60">
            {invoices.map((inv, i) => {
              const detail = (inv.detail ?? {}) as AnyObj;
              const amount = (inv.amount ?? {}) as AnyObj;
              const recip = arr(inv.primary_recipients)[0] as AnyObj | undefined;
              const billing = (recip?.billing_info ?? {}) as AnyObj;
              const status = str(inv.status ?? detail.invoice_status);
              return (
                <li key={str(inv.id) || i} className="flex items-center justify-between px-4 py-3 text-[13px]">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {str(detail.invoice_number) || str(inv.id) || `Invoice ${i + 1}`}
                    </div>
                    <div className="text-[11px] text-ink-soft">
                      {str(billing.email_address) || "—"} · {str(detail.invoice_date ?? detail.create_time).slice(0, 10)}
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-3">
                    <span className="font-semibold">${num(amount.value)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      status === "PAID" ? "bg-ok/15 text-ok" : status === "SENT" ? "bg-accent/15 text-accent-strong" : "bg-line/40 text-ink-soft"
                    }`}>
                      {status || "—"}
                    </span>
                    {status === "DRAFT" && (
                      <button
                        onClick={() => post({ action: "sendInvoice", invoiceId: inv.id })}
                        className="flex items-center gap-1 text-[11px] font-medium text-accent-strong hover:underline"
                      >
                        <Send className="h-3 w-3" /> {t("pay.send")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Payments — transactions received + disputes on file. */
export function SellerPayments() {
  const { t } = usePrefs();
  const { data, busy, load } = usePayments();
  const txns = arr((data?.transactions as AnyObj)?.transaction_details).map(
    (d) => ((d as AnyObj).transaction_info ?? {}) as AnyObj,
  );
  const disputes = arr((data?.disputes as AnyObj)?.items ?? (data?.disputes as AnyObj)?.disputes);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-ink-soft">{t("pay.paymentsSub")}</p>
        <button
          onClick={load}
          disabled={busy}
          className="rounded-md border border-line p-2 text-ink-soft hover:text-ink disabled:opacity-50"
          title={t("pay.refresh")}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
        </button>
      </div>
      <ErrorNote msg={data?.errors?.transactions} />
      <ErrorNote msg={data?.errors?.disputes} />

      <div className="rounded-xl border border-line bg-card">
        <div className="border-b border-line px-4 py-3">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
            <CreditCard className="h-4 w-4 text-accent" /> {t("pay.transactions")}
          </h3>
        </div>
        {!data ? (
          <div className="p-6 text-center text-[12px] text-ink-soft">{t("pay.loading")}</div>
        ) : txns.length === 0 ? (
          <p className="p-6 text-center text-[12px] text-ink-soft">{t("pay.noTxns")}</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {txns.map((tx, i) => {
              const amount = (tx.transaction_amount ?? {}) as AnyObj;
              const status = str(tx.transaction_status);
              return (
                <li key={str(tx.transaction_id) || i} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{str(tx.transaction_id) || `txn-${i}`}</div>
                    <div className="text-[11px] text-ink-soft">
                      {str(tx.transaction_initiation_date ?? tx.transaction_updated_date).slice(0, 10)}
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <span className={`font-semibold ${Number(amount.value) >= 0 ? "text-ok" : "text-danger"}`}>
                      {Number(amount.value) >= 0 ? "+" : ""}${num(amount.value)}
                    </span>
                    <span className="rounded-full bg-line/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">
                      {status || "—"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-line bg-card">
        <div className="border-b border-line px-4 py-3">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-warn" /> {t("pay.disputes")}
          </h3>
        </div>
        {!data ? (
          <div className="p-6 text-center text-[12px] text-ink-soft">{t("pay.loading")}</div>
        ) : disputes.length === 0 ? (
          <p className="p-6 text-center text-[12px] text-ink-soft">{t("pay.noDisputes")}</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {disputes.map((d, i) => (
              <li key={str(d.dispute_id) || i} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <div className="truncate font-medium">{str(d.dispute_id) || `dispute-${i}`}</div>
                  <div className="text-[11px] text-ink-soft">{str(d.reason).replace(/_/g, " ") || "—"}</div>
                </div>
                <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-danger">
                  {str(d.status) || "open"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
