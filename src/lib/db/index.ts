import { drizzle as drizzleNeon, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzleLite, PgliteDatabase } from "drizzle-orm/pglite";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import fs from "node:fs";
import { env } from "../env";
import * as schema from "./schema";

export type Db =
  | PostgresJsDatabase<typeof schema>
  | PgliteDatabase<typeof schema>;

/**
 * Next.js compiles this module into multiple bundles (route handlers, RSC)
 * with separate module state — module-level vars alone would open one PGlite
 * instance per bundle on the same data dir. globalThis is shared across
 * bundles in the same process, so the connection lives there.
 */
const g = globalThis as unknown as {
  __parleyDb?: Db;
  __parleyBoot?: Promise<void>;
};

/**
 * Neon Postgres when DATABASE_URL is set (production/Render),
 * embedded PGlite otherwise (zero-setup local dev). Same dialect, same schema.
 */
export function getDb(): Db {
  if (g.__parleyDb) return g.__parleyDb;
  if (env.databaseUrl) {
    g.__parleyDb = drizzleNeon(postgres(env.databaseUrl, { prepare: false }), { schema });
  } else {
    // PGlite does not create parent dirs — make them ourselves.
    fs.mkdirSync("./.data", { recursive: true });
    g.__parleyDb = drizzleLite(new PGlite("./.data/parley"), { schema });
  }
  return g.__parleyDb;
}

const BOOTSTRAP = `
create table if not exists policies (
  id text primary key,
  name text not null,
  max_per_tx_cents integer not null,
  daily_cap_cents integer not null,
  monthly_cap_cents integer not null,
  autonomous_limit_cents integer not null default 0,
  allowed_vendors jsonb,
  active boolean not null default true,
  created_at timestamptz default now()
);
create table if not exists orders_local (
  id text primary key,
  paypal_order_id text not null unique,
  authorization_id text,
  status text not null,
  title text not null,
  vendor text,
  amount_cents integer not null,
  currency text not null default 'USD',
  quantity integer not null default 1,
  agreed_price_cents integer,
  negotiated boolean not null default false,
  product_snapshot jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  delivered_at timestamptz
);
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  actor text not null,
  action text not null,
  input jsonb,
  output jsonb,
  rationale text,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(10,6)
);
create table if not exists vendor_scores (
  domain text primary key,
  score integer not null default 50,
  orders_count integer not null default 0,
  on_time_count integer not null default 0,
  disputes_count integer not null default 0,
  notes text,
  updated_at timestamptz default now()
);
create table if not exists alerts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null,
  payload jsonb,
  status text not null default 'open'
);
create table if not exists users (
  id text primary key,
  username text not null unique,
  email text not null unique,
  password_hash text not null,
  role text not null default 'demo',
  created_at timestamptz default now(),
  last_login_at timestamptz
);
create table if not exists sessions (
  id text primary key,
  user_id text not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  ip text,
  user_agent text
);
create table if not exists messages (
  id bigint generated always as identity primary key,
  user_id text not null,
  role text not null,
  parts jsonb,
  created_at timestamptz default now()
);
create table if not exists product_cache (
  id text primary key,
  user_id text not null,
  product jsonb not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);
create table if not exists negotiations (
  id text primary key,
  user_id text not null,
  product_id text not null,
  list_price_cents integer not null,
  agreed_cents integer,
  status text not null default 'open',
  transcript jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table orders_local add column if not exists user_id text;
alter table orders_local add column if not exists authorization_expires_at timestamptz;
alter table audit_log add column if not exists user_id text;
create table if not exists spaces (
  id text primary key,
  user_id text not null,
  name text not null,
  color text not null default 'teal',
  created_at timestamptz default now()
);
alter table policies add column if not exists space_id text;
alter table orders_local add column if not exists space_id text;
alter table audit_log add column if not exists space_id text;
alter table messages add column if not exists space_id text;
alter table negotiations add column if not exists space_id text;
alter table alerts add column if not exists space_id text;
alter table users add column if not exists persona text not null default 'buyer';
alter table orders_local add column if not exists tracking_number text;
alter table orders_local add column if not exists carrier text;
alter table orders_local add column if not exists tracking_status text;
alter table orders_local add column if not exists invoice_id text;
alter table orders_local add column if not exists reorder_rule_id text;
alter table orders_local add column if not exists captured_cents integer not null default 0;
create table if not exists merchant_profiles (
  id text primary key,
  user_id text not null unique,
  display_name text not null,
  floor_ratio_pct integer not null default 85,
  style text not null default 'balanced',
  created_at timestamptz default now()
);
create table if not exists seller_products (
  id text primary key,
  user_id text not null,
  title text not null,
  price_cents integer not null,
  currency text not null default 'USD',
  stock integer not null default 10,
  created_at timestamptz default now()
);
create table if not exists merchant_sales (
  id text primary key,
  seller_user_id text not null,
  product_title text not null,
  agreed_cents integer not null,
  buyer_label text,
  status text not null default 'agreed',
  created_at timestamptz default now()
);
create table if not exists reorder_rules (
  id text primary key,
  user_id text not null,
  space_id text not null,
  query text not null,
  vendor_domain text,
  quantity integer not null default 1,
  max_unit_price_cents integer not null,
  interval_days integer not null default 30,
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz default now()
);
insert into policies (id, name, max_per_tx_cents, daily_cap_cents, monthly_cap_cents, autonomous_limit_cents, allowed_vendors, active)
select 'default', 'Default spend policy', 25000, 75000, 300000, 5000, null, true
where not exists (select 1 from policies where id = 'default');
`;

/** Idempotent schema bootstrap — runs once per process, lazily on first use. */
export function ensureDb(): Promise<void> {
  return (g.__parleyBoot ??= (async () => {
    try {
      const db = getDb();
      for (const stmt of BOOTSTRAP.split(";").map((s) => s.trim()).filter(Boolean)) {
        await db.execute(sql.raw(stmt));
      }
      await seedAdmin(db);
      await backfillSpaces(db);
    } catch (e) {
      g.__parleyBoot = undefined; // allow retry instead of caching a rejection forever
      throw e;
    }
  })());
}

/**
 * Seed the admin account from env (ADMIN_USERNAME/ADMIN_EMAIL/ADMIN_PASSWORD).
 * Only creates the row if it doesn't exist — credentials live in env, never git.
 */
async function seedAdmin(db: Db) {
  if (!env.adminUsername || !env.adminEmail || !env.adminPassword) return;
  const { hashPassword } = await import("../auth");
  const rows = (await db.execute(
    sql`select 1 from users where username = ${env.adminUsername}`,
  )) as unknown;
  const exists = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] })?.rows ?? []).length > 0;
  if (exists) return;
  await db.execute(
    sql`insert into users (id, username, email, password_hash, role)
        values (${crypto.randomUUID()}, ${env.adminUsername}, ${env.adminEmail}, ${hashPassword(env.adminPassword)}, 'admin')`,
  );
}

/**
 * Every user gets a "Personal" space + a policy row copied from the 'default'
 * template. Pre-spaces rows (orders/messages/audit/negotiations) are assigned
 * to that space so nothing floats unscoped.
 */
async function backfillSpaces(db: Db) {
  const res = (await db.execute(sql`select id from users`)) as unknown;
  const userRows = (Array.isArray(res) ? res : (res as { rows?: { id: string }[] })?.rows ?? []) as { id: string }[];
  for (const { id: userId } of userRows) {
    const spaceRes = (await db.execute(
      sql`insert into spaces (id, user_id, name, color)
          select ${crypto.randomUUID()}, ${userId}, 'Personal', 'teal'
          where not exists (select 1 from spaces where user_id = ${userId})
          returning id`,
    )) as unknown;
    const created = (Array.isArray(spaceRes) ? spaceRes : (spaceRes as { rows?: { id: string }[] })?.rows ?? []) as { id: string }[];
    const [space] =
      created.length > 0
        ? created
        : (((await db.execute(
            sql`select id from spaces where user_id = ${userId} order by created_at limit 1`,
          )) as unknown) as { id: string }[]);
    if (!space) continue;
    // The space gets its own policy row — caps are per-space, never shared.
    await db.execute(
      sql`insert into policies (id, space_id, name, max_per_tx_cents, daily_cap_cents, monthly_cap_cents, autonomous_limit_cents, allowed_vendors, active)
          select ${`pol_${space.id}`}, ${space.id}, name, max_per_tx_cents, daily_cap_cents, monthly_cap_cents, autonomous_limit_cents, allowed_vendors, active
          from policies where id = 'default'
          and not exists (select 1 from policies where space_id = ${space.id})`,
    );
    for (const table of ["orders_local", "messages", "audit_log", "negotiations"]) {
      await db.execute(
        sql.raw(
          `update ${table} t set space_id = '${space.id}' from spaces s where s.user_id = t.user_id and s.id = '${space.id}' and t.space_id is null and t.user_id = '${userId}'`,
        ),
      );
    }
  }
}
