import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ensureDb, getDb } from "@/lib/db";
import { merchantSales, ordersLocal, spaces, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { PrintButton } from "./print-button";

export const maxDuration = 30;

const usd = (c: number | null | undefined) =>
  c == null ? "—" : `$${(c / 100).toFixed(2)}`;

const STATUS_LABEL: Record<string, string> = {
  created: "Order created",
  approved: "Approved on PayPal",
  authorized: "Funds authorized — held in escrow",
  shipped: "Shipped",
  delivered: "Delivery confirmed",
  captured: "Payment released to seller",
  voided: "Authorization voided — funds returned",
  cancelled: "Cancelled",
  failed: "Failed",
};

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#e7e2d9] py-2.5 last:border-0">
      <span className="text-[12px] uppercase tracking-wide text-[#8a8577]">{k}</span>
      <span className={`text-right text-[13.5px] font-medium ${mono ? "font-mono text-[12px]" : ""}`}>{v}</span>
    </div>
  );
}

/** Parley-branded invoice/receipt for one order — printable to PDF. Reached
 *  from the order drawer and the pipeline; doubles as the buyer's record of
 *  what the agent bought, for how much, and where the money sat. */
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  await ensureDb();
  const db = getDb();

  const [order] = await db
    .select()
    .from(ordersLocal)
    .where(eq(ordersLocal.paypalOrderId, id))
    .limit(1);
  // The buyer owns it; the seller who sold it may also view the receipt.
  const [sale] = order
    ? await db
        .select({ sellerUserId: merchantSales.sellerUserId })
        .from(merchantSales)
        .where(eq(merchantSales.buyerOrderId, order.id))
        .limit(1)
    : [undefined];
  if (!order || (order.userId !== user.id && sale?.sellerUserId !== user.id))
    notFound();

  const [buyer] = order.userId
    ? await db.select({ username: users.username }).from(users).where(eq(users.id, order.userId)).limit(1)
    : [undefined];
  const [space] = order.spaceId
    ? await db.select({ name: spaces.name }).from(spaces).where(eq(spaces.id, order.spaceId)).limit(1)
    : [undefined];

  const invoiceNo = `PRL-${order.id.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase()}`;
  const savings =
    order.negotiated && order.agreedPriceCents != null
      ? order.amountCents - order.agreedPriceCents
      : 0;

  return (
    <div className="min-h-screen bg-[#f4f1ea] px-4 py-10 text-[#1c1a15] print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <a href="/pipeline" className="text-[12.5px] text-[#8a8577] hover:text-[#1c1a15]">← Back to pipeline</a>
          <PrintButton />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e7e2d9] bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          {/* Header */}
          <div className="flex items-start justify-between bg-[#0a0f0d] px-8 py-7 text-white">
            <div>
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.svg" alt="" className="h-7 w-7" />
                <span className="font-display text-xl font-semibold tracking-tight">Parley</span>
              </div>
              <p className="mt-1 text-[11px] text-white/60">procurement that negotiates — agentic escrow receipt</p>
            </div>
            <div className="text-right">
              <div className="font-mono text-[13px] text-[#2dd4bf]">{invoiceNo}</div>
              <div className="mt-0.5 text-[11px] text-white/60">
                {order.createdAt?.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>
          </div>

          <div className="px-8 py-7">
            {/* Parties */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8a8577]">Billed to</div>
                <div className="mt-1 text-[14px] font-semibold">{buyer?.username ?? "—"}</div>
                {space && <div className="text-[11.5px] text-[#8a8577]">space · {space.name}</div>}
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8a8577]">Vendor</div>
                <div className="mt-1 text-[14px] font-semibold">{order.vendor ?? "—"}</div>
                <div className="text-[11.5px] text-[#8a8577]">price negotiated by AI agent</div>
              </div>
            </div>

            {/* Line item */}
            <table className="mt-6 w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-[#1c1a15] text-left text-[10px] font-semibold uppercase tracking-wider text-[#8a8577]">
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#e7e2d9]">
                  <td className="py-3 pr-4 text-[13.5px] font-medium">{order.title}</td>
                  <td className="py-3 text-right text-[13.5px]">{order.quantity}</td>
                  <td className="py-3 text-right text-[13.5px] font-semibold">{usd(order.amountCents)}</td>
                </tr>
                {savings > 0 && (
                  <tr className="border-b border-[#e7e2d9] text-[#0d9488]">
                    <td className="py-2.5 pr-4 text-[12.5px]">Agent negotiation discount</td>
                    <td className="py-2.5" />
                    <td className="py-2.5 text-right text-[12.5px] font-semibold">−{usd(savings)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-3 text-[11px] font-semibold uppercase tracking-wider text-[#8a8577]">Total held in escrow</td>
                  <td />
                  <td className="pt-3 text-right font-display text-lg font-bold">{usd(order.amountCents)}</td>
                </tr>
                <tr>
                  <td className="pt-1 text-[11px] uppercase tracking-wider text-[#8a8577]">Released to vendor</td>
                  <td />
                  <td className="pt-1 text-right text-[13.5px] font-semibold text-[#0d9488]">{usd(order.capturedCents)}</td>
                </tr>
              </tfoot>
            </table>

            {/* Escrow lifecycle */}
            <div className="mt-7">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8a8577]">Escrow lifecycle</div>
              <ol className="mt-2 space-y-1.5">
                {["created", "approved", "authorized", "shipped", "delivered", "captured"].map((s) => {
                  const order_ = ["created","approved","authorized","shipped","delivered","captured"];
                  const reached = order_.indexOf(order.status) >= order_.indexOf(s) && order.status !== "voided" && order.status !== "cancelled";
                  const isCurrent = order.status === s || (s === "captured" && order.status === "voided");
                  return (
                    <li key={s} className="flex items-center gap-2.5 text-[12.5px]">
                      <span className={`h-2 w-2 rounded-full ${reached || order.status === s ? "bg-[#0d9488]" : "bg-[#ddd8cc]"}`} />
                      <span className={reached || order.status === s ? "font-medium" : "text-[#8a8577]"}>
                        {STATUS_LABEL[s]}
                        {isCurrent && " ·"}
                      </span>
                    </li>
                  );
                })}
                {(order.status === "voided" || order.status === "cancelled") && (
                  <li className="flex items-center gap-2.5 text-[12.5px]">
                    <span className="h-2 w-2 rounded-full bg-[#b45309]" />
                    <span className="font-medium">{STATUS_LABEL[order.status]}</span>
                  </li>
                )}
              </ol>
            </div>

            {/* References */}
            <div className="mt-7 rounded-xl bg-[#f4f1ea] px-5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8a8577]">References</div>
              <div className="mt-1.5">
                <Row k="PayPal order" v={order.paypalOrderId} mono />
                {order.authorizationId && <Row k="Authorization" v={order.authorizationId} mono />}
                {order.trackingNumber && <Row k="Tracking" v={`${order.carrier ?? ""} · ${order.trackingNumber}`} />}
                {order.negotiationId && <Row k="Negotiation" v={order.negotiationId} mono />}
                <Row k="Status" v={order.status} />
              </div>
            </div>

            <p className="mt-6 text-center text-[10.5px] leading-relaxed text-[#8a8577]">
              Funds were held in PayPal escrow and released only after confirmed delivery.
              This receipt was generated by Parley — every action audited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
