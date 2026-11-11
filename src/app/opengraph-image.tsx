import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social/Devpost share card — paper field, teal mark, product claim.
export default async function OpengraphImage() {
  const markSvg = await readFile(
    path.join(process.cwd(), "public", "parley-mark.svg"),
    "utf8",
  );
  const markUrl = `data:image/svg+xml;base64,${Buffer.from(markSvg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafaf8",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders to PNG, next/image does not apply */}
          <img src={markUrl} width={140} height={140} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 88,
                fontWeight: 700,
                color: "#17150f",
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              Parley
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 34,
                color: "#6b675c",
                lineHeight: 1.3,
                maxWidth: 640,
              }}
            >
              Procurement that negotiates — and holds your money until goods
              arrive.
            </div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 56,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 26,
            color: "#0f766e",
            fontWeight: 600,
          }}
        >
          Two agents · PayPal agentic escrow · every action audited
        </div>
      </div>
    ),
    size,
  );
}
