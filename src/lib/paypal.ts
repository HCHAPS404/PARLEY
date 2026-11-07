import { env, paypalBaseUrl } from "./env";

/**
 * Minimal PayPal REST client for the operations the Agent Toolkit does not
 * cover: escrow-style orders (intent=AUTHORIZE → authorize → capture).
 * All monetary flows go through here — nothing on the client ever touches
 * PayPal write APIs directly.
 */

let tokenCache: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }
  const res = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${env.paypalClientId}:${env.paypalClientSecret}`).toString(
          "base64",
        ),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal OAuth failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return tokenCache.token;
}

export async function paypalFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  idempotencyKey?: string,
): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${paypalBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "PayPal-Request-Id": idempotencyKey } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new Error(
      `PayPal ${init.method ?? "GET"} ${path} → ${res.status}: ${text}`,
    );
  }
  return body as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─── Orders v2: escrow flow ─────────────────────────────────────────

export interface EscrowOrderInput {
  amountCents: number;
  currency?: string;
  description: string;
  vendorName?: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface PayPalOrder {
  id: string;
  status: string;
  links?: { rel: string; href: string; method: string }[];
  purchase_units?: {
    reference_id?: string;
    payments?: {
      authorizations?: { id: string; status: string }[];
      captures?: { id: string; status: string }[];
    };
  }[];
}

/** Create an order that AUTHORIZES funds without capturing them (escrow hold). */
export function createEscrowOrder(input: EscrowOrderInput) {
  const amount = (input.amountCents / 100).toFixed(2);
  const currency = input.currency ?? "USD";
  return paypalFetch<PayPalOrder>(
    "/v2/checkout/orders",
    {
      method: "POST",
      body: JSON.stringify({
        intent: "AUTHORIZE",
        purchase_units: [
          {
            amount: { currency_code: currency, value: amount },
            description: input.description.slice(0, 127),
            custom_id: input.vendorName?.slice(0, 127),
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: input.returnUrl,
              cancel_url: input.cancelUrl,
              user_action: "PAY_NOW",
              shipping_preference: "NO_SHIPPING",
            },
          },
        },
      }),
    },
    crypto.randomUUID(),
  );
}

export function getOrder(orderId: string) {
  return paypalFetch<PayPalOrder>(`/v2/checkout/orders/${orderId}`);
}

/** Authorize the order after the buyer approves it. Moves status to COMPLETED and returns authorization id. */
export function authorizeOrder(orderId: string) {
  return paypalFetch<PayPalOrder>(
    `/v2/checkout/orders/${orderId}/authorize`,
    { method: "POST", body: "{}" },
    crypto.randomUUID(),
  );
}

/** Release the held funds to the seller — call only after delivery is confirmed. */
export function captureAuthorization(authorizationId: string) {
  return paypalFetch<{ id: string; status: string }>(
    `/v2/checkout/authorizations/${authorizationId}/capture`,
    { method: "POST", body: "{}" },
    crypto.randomUUID(),
  );
}

/** Cancel a hold (never delivered / negotiation failed). */
export function voidAuthorization(authorizationId: string) {
  return paypalFetch<{ id: string; status: string }>(
    `/v2/checkout/authorizations/${authorizationId}/void`,
    { method: "POST", body: "{}" },
    crypto.randomUUID(),
  );
}
