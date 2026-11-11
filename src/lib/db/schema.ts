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

/** Registered accounts. admin = owner toolkit; user = full buyer agent; demo = read-mostly. */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // admin|user|demo — permission tier
  persona: text("persona").notNull().default("buyer"), // buyer|seller — product side
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

/** Server-side sessions. Stores a SHA-256 of the bearer token, never the token. */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256(token)
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
});

/** Workspaces — a freelancer's clients or a shop's product lines. Each space
 * owns its policy, orders, audit and chat history; vendor scores stay global. */
export const spaces = pgTable("spaces", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("teal"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Named chat threads — each holds an isolated agent conversation. */
export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  spaceId: text("space_id"),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Per-user chat history — durable trace of the conversation. */
export const messages = pgTable("messages", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: text("user_id").notNull(),
  spaceId: text("space_id"),
  conversationId: text("conversation_id"),
  role: text("role").notNull(), // user|assistant
  parts: jsonb("parts"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Server-side product resolution — survives restarts, expires in 30 min. */
export const productCache = pgTable("product_cache", {
  id: text("id").primaryKey(), // Channel3 product id
  userId: text("user_id").notNull(),
  product: jsonb("product").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Agent-to-agent negotiations — persisted so quotes survive turn boundaries. */
export const negotiations = pgTable("negotiations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  spaceId: text("space_id"),
  productId: text("product_id").notNull(),
  listPriceCents: integer("list_price_cents").notNull(),
  agreedCents: integer("agreed_cents"),
  status: text("status").notNull().default("open"), // open|agreed|walked
  transcript: jsonb("transcript"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/** Deterministic spending rules the agent can never override. */
export const policies = pgTable("policies", {
  id: text("id").primaryKey(),
  spaceId: text("space_id"), // owning space — null only for the 'default' template row
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
  userId: text("user_id"), // owner — null only for pre-auth rows
  spaceId: text("space_id"),
  paypalOrderId: text("paypal_order_id").notNull().unique(),
  authorizationId: text("authorization_id"),
  authorizationExpiresAt: timestamp("authorization_expires_at", { withTimezone: true }),
  status: text("status").notNull(), // created|approved|authorized|delivered|captured|voided|cancelled|failed
  title: text("title").notNull(),
  vendor: text("vendor"),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  trackingStatus: text("tracking_status"), // SHIPPED|IN_TRANSIT|DELIVERED|...
  invoiceId: text("invoice_id"), // PayPal invoice issued by the merchant
  reorderRuleId: text("reorder_rule_id"), // which rule created this order, if autonomous
  capturedCents: integer("captured_cents").notNull().default(0), // partial releases accumulate here
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
  userId: text("user_id"), // whose action — null for system-level events
  spaceId: text("space_id"),
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

/** Products the agent watches — watchdog polls Channel3 price history and alerts on drops. */
export const priceWatches = pgTable("price_watches", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  spaceId: text("space_id"),
  productId: text("product_id"), // single-product watch — null for query watches
  query: text("query"), // market watch — best offer matching this search query
  title: text("title").notNull(),
  baselineCents: integer("baseline_cents").notNull(), // price when the watch was armed
  thresholdCents: integer("threshold_cents"), // alert-below target, if the user named one
  lastCents: integer("last_cents"),
  currency: text("currency").notNull().default("USD"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Proactive findings from the watchdog job. */
export const alerts = pgTable("alerts", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  kind: text("kind").notNull(), // duplicate_charge|price_hike|better_price|delivery_overdue|delivered|reorder_ready|reorder_created
  spaceId: text("space_id"),
  payload: jsonb("payload"),
  status: text("status").notNull().default("open"), // open|acted|dismissed
});

/** The user as SELLER — their own merchant agent, reachable over /api/mcp. */
export const merchantProfiles = pgTable("merchant_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(), // one merchant persona per user
  displayName: text("display_name").notNull(), // e.g. "Acme Supply Co."
  floorRatioPct: integer("floor_ratio_pct").notNull().default(85), // % of list = margin floor
  style: text("style").notNull().default("balanced"), // aggressive|balanced|conservative
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** What the user's merchant agent sells — their own catalog. */
export const sellerProducts = pgTable("seller_products", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  stock: integer("stock").notNull().default(10),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Sales closed by the user's merchant agent — the seller-side ledger. */
export const merchantSales = pgTable("merchant_sales", {
  id: text("id").primaryKey(),
  sellerUserId: text("seller_user_id").notNull(),
  productTitle: text("product_title").notNull(),
  agreedCents: integer("agreed_cents").notNull(),
  listCents: integer("list_cents"), // list price at close — avg discount metric
  buyerLabel: text("buyer_label"), // who the agent sold to, if known
  buyerOrderId: text("buyer_order_id"), // buyer's escrow order — links the two ledgers
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  status: text("status").notNull().default("agreed"), // agreed|invoiced|shipped|paid
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Every negotiation round the seller's agent handles — the live activity feed. */
export const sellerEvents = pgTable("seller_events", {
  id: text("id").primaryKey(),
  sellerUserId: text("seller_user_id").notNull(),
  productTitle: text("product_title").notNull(),
  buyerLabel: text("buyer_label"),
  kind: text("kind").notNull(), // offer|counter|accept|walk
  offerCents: integer("offer_cents"),
  counterCents: integer("counter_cents"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Seller-run promotions — an active campaign lowers the agent's working
 *  "list" price for a product (or the whole catalog), while the margin floor
 *  still protects the original list price. */
export const sellerCampaigns = pgTable("seller_campaigns", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  pctOff: integer("pct_off").notNull(), // 1–70, % off the list price
  productId: text("product_id"), // null → applies to the whole catalog
  startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Autonomous procurement rules — the agent reorders on a schedule, inside policy. */
export const reorderRules = pgTable("reorder_rules", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  spaceId: text("space_id").notNull(),
  query: text("query").notNull(), // what to search for, e.g. "kraft shipping boxes"
  vendorDomain: text("vendor_domain"), // optional pinned vendor
  quantity: integer("quantity").notNull().default(1),
  maxUnitPriceCents: integer("max_unit_price_cents").notNull(), // never buy above this
  intervalDays: integer("interval_days").notNull().default(30),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
