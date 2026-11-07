import { NextResponse } from "next/server";

/** Buyer cancelled the PayPal approval — nothing was held. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(new URL("/?cancelled=1", url.origin));
}
