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

let _db: Db | null = null;
let _boot: Promise<void> | null = null;

/**
 * Neon Postgres when DATABASE_URL is set (production/Render),
 * embedded PGlite otherwise (zero-setup local dev). Same dialect, same schema.
 */
export function getDb(): Db {
  if (_db) return _db;
  if (env.databaseUrl) {
    _db = drizzleNeon(postgres(env.databaseUrl, { prepare: false }), { schema });
  } else {
    // PGlite does not create parent dirs — make them ourselves.
    fs.mkdirSync("./.data", { recursive: true });
    _db = drizzleLite(new PGlite("./.data/parley"), { schema });
  }
  return _db;
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
insert into policies (id, name, max_per_tx_cents, daily_cap_cents, monthly_cap_cents, autonomous_limit_cents, allowed_vendors, active)
select 'default', 'Default spend policy', 25000, 75000, 300000, 5000, null, true
where not exists (select 1 from policies where id = 'default');
`;

/** Idempotent schema bootstrap — runs once per process, lazily on first use. */
export function ensureDb(): Promise<void> {
  return (_boot ??= (async () => {
    const db = getDb();
    for (const stmt of BOOTSTRAP.split(";").map((s) => s.trim()).filter(Boolean)) {
      await db.execute(sql.raw(stmt));
    }
  })());
}
