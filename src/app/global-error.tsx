"use client";

export const instant = false;

// Last-resort boundary — the root layout itself failed, so render a bare page
// with no shared chrome, fonts, or i18n (they may be what broke).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#fafaf8",
          color: "#17150f",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 340 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>
            Parley ran into an error
          </h1>
          <p style={{ fontSize: 13, color: "#6b675c", marginTop: 8 }}>
            Something failed at the root of the app. Reloading usually fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: "#0f766e",
              color: "white",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <p style={{ fontSize: 10, color: "#9c968a", marginTop: 24 }}>
            {error?.digest ? `ref ${error.digest}` : ""}
          </p>
        </div>
      </body>
    </html>
  );
}
