import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { paypalTools } from "@/lib/paypal-toolkit";
import { audit } from "@/lib/audit";

export const maxDuration = 60;

type Tools = Record<string, { execute?: (a: unknown) => Promise<unknown> }>;

/** Toolkit tools resolve with a JSON *string*; errors come back as {"ok":false,...}
 * payloads instead of thrown exceptions — unwrap both cases. */
function unwrap(result: unknown): { data?: unknown; error?: string } {
  let parsed = result;
  if (typeof result === "string") {
    try { parsed = JSON.parse(result); } catch { return { data: result }; }
  }
  if (parsed && typeof parsed === "object" && "ok" in parsed && (parsed as { ok: unknown }).ok === false) {
    const e = parsed as { message?: string; status?: number };
    const msg = (e.message ?? "PayPal error").split(":")[0].slice(0, 160);
    return { error: e.status ? `${e.status} — ${msg}` : msg };
  }
  return { data: parsed };
}

/** Seller's PayPal surface — invoices, transactions, disputes via the Agent Toolkit. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tools = paypalTools() as Tools;
  const out: Record<"invoices" | "transactions" | "disputes", unknown> & {
    errors: Record<string, string>;
  } = { invoices: undefined, transactions: undefined, disputes: undefined, errors: {} };

  const end = new Date();
  const start = new Date(end.getTime() - 90 * 86_400_000);
  const calls: ["invoices" | "transactions" | "disputes", string, Record<string, unknown>][] = [
    ["invoices", "list_invoices", {}],
    ["transactions", "list_transactions", {
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    }],
    ["disputes", "list_disputes", {}],
  ];
  await Promise.all(
    calls.map(async ([key, toolName, args]) => {
      try {
        const r = unwrap(await tools[toolName]?.execute?.(args));
        if (r.error) out.errors[key] = r.error;
        else out[key] = r.data;
      } catch (e) {
        out.errors[key] = e instanceof Error ? e.message.slice(0, 200) : "PayPal error";
      }
    }),
  );
  return NextResponse.json(out);
}

/** Create + send an invoice, or resend an existing one. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as {
    action?: string;
    invoiceId?: string;
    email?: string;
    itemTitle?: string;
    amountUsd?: number;
    note?: string;
  };
  const tools = paypalTools() as Tools;

  if (body.action === "sendInvoice") {
    const invoiceId = String(body.invoiceId ?? "");
    if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
    try {
      const r = unwrap(await tools["send_invoice"]?.execute?.({ invoice_id: invoiceId }));
      if (r.error) return NextResponse.json({ error: r.error }, { status: 502 });
      await audit({
        actor: "user", action: "seller_invoice_send", userId: user.id,
        input: { invoiceId },
        rationale: "Seller re-sent a PayPal invoice from the payments console",
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "send failed" }, { status: 502 });
    }
  }

  if (body.action === "createInvoice") {
    const email = String(body.email ?? "").trim();
    const title = String(body.itemTitle ?? "").trim().slice(0, 120);
    const cents = Math.round(Number(body.amountUsd) * 100);
    if (!email.includes("@") || !title || !Number.isInteger(cents) || cents <= 0)
      return NextResponse.json({ error: "email + itemTitle + positive amountUsd required" }, { status: 400 });
    const value = (cents / 100).toFixed(2);
    try {
      const created = unwrap(
        await tools["create_invoice"]?.execute?.({
          currency_code: "USD",
          note: String(body.note ?? "").slice(0, 200) || "Parley sale",
          primary_recipients: [{ billing_info: { email_address: email } }],
          items: [{ name: title.slice(0, 127), quantity: "1", unit_amount: { currency_code: "USD", value } }],
        }),
      );
      if (created.error) return NextResponse.json({ error: created.error }, { status: 502 });
      // Toolkit returns a link object ({href: ".../invoices/INV2-..."}) — id lives in the path.
      const createdObj = (created.data ?? {}) as { id?: string; href?: string };
      const invoiceId = createdObj.id ?? createdObj.href?.split("/").pop();
      if (!invoiceId) return NextResponse.json({ error: "Invoice creation returned no id" }, { status: 502 });
      const sent = unwrap(await tools["send_invoice"]?.execute?.({ invoice_id: invoiceId }));
      if (sent.error) return NextResponse.json({ error: sent.error }, { status: 502 });
      await audit({
        actor: "user", action: "seller_invoice_create", userId: user.id,
        input: { email, title, cents, invoiceId },
        rationale: "Seller issued a PayPal invoice from the payments console",
      });
      return NextResponse.json({ ok: true, invoiceId });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "create failed" }, { status: 502 });
    }
  }

  return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
}
