"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Logo } from "@/components/brand";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[parley] route error:", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      <div className="max-w-sm text-center">
        <Logo className="mx-auto h-10 w-10 opacity-60" />
        <div className="mt-5 flex items-center justify-center gap-2 text-danger">
          <TriangleAlert className="h-4 w-4" />
          <h1 className="font-display text-lg font-semibold tracking-tight">
            Something went wrong
          </h1>
        </div>
        <p className="mt-2 text-[13px] text-ink-soft">
          The agent hit an unexpected error. Your session and data are safe —
          try again.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-strong"
          >
            Try again
          </button>
          <Link
            href="/app"
            className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-ink-soft hover:text-ink"
          >
            Back to the agent
          </Link>
        </div>
      </div>
    </div>
  );
}
