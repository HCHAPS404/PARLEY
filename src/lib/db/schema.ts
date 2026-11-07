import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  numeric,
} from "drizzle-orm/pg-core";

/** Deterministic spending rules the agent can never override. */
export const policies = pgTable("policies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  maxPerTxCents: integer("max_per_tx_cents").notNull(),
  dailyCapCents: integer("daily_cap_cents").notNull(),
  monthlyCapCents: integer("monthly_cap_cents").notNull(),
  autonomousLimitCents: integer("autonomous_limit_cents").notNull().default(0),
  allowedVendors: jsonb("allowed_vendors").$type<string[] | null>(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Local mirror of escrow orders; PayPal remains source of truth for money. */
export const ordersLocal = pgTable("orders_local", {
  id: text("id").primaryKey(), // ulid/uuid generated in code
  paypalOrderId: text("paypal_order_id").notNull().unique(),
  authorizationId: text("authorization_id"),
  status: text("status").notNull(), // created|approved|authorized|captured|voided|failed
  title: text("title").notNull(),
  vendor: text("vendor"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  quantity: integer("quantity").notNull().default(1),
  agreedPriceCents: integer("agreed_price_cents"),
  negotiated: boolean("negotiated").notNull().default(false),
  productSnapshot: jsonb("product_snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
});

/** Append-only black box: every agent/system action with rationale and token cost. */
export const auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  actor: text("actor").notNull(), // user|agent|merchant|system
  action: text("action").notNull(),
  input: jsonb("input"),
  output: jsonb("output"),
  rationale: text("rationale"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
});

/** Learned reputation per vendor — the agent's memory of who delivers. */
export const vendorScores = pgTable("vendor_scores", {
  domain: text("domain").primaryKey(),
  score: integer("score").notNull().default(50), // 0-100
  ordersCount: integer("orders_count").notNull().default(0),
  onTimeCount: integer("on_time_count").notNull().default(0),
  disputesCount: integer("disputes_count").notNull().default(0),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/** Proactive findings from the watchdog job. */
export const alerts = pgTable("alerts", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  kind: text("kind").notNull(), // duplicate_charge|price_hike|better_price|delivery_overdue
  payload: jsonb("payload"),
  status: text("status").notNull().default("open"), // open|acted|dismissed
});
