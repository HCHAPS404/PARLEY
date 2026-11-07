import Link from "next/link";
import { StudioLoader } from "@/components/studio-loader";

export default function AnalyticsPage() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-stone-200 px-6 py-3">
        <div>
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">
            ← Parley
          </Link>
          <h1 className="font-display text-lg font-semibold text-stone-900">
            Procurement analytics
          </h1>
          <p className="text-xs text-stone-500">
            Orders · agent activity · vendor scores · watchdog alerts — build
            your own reports
          </p>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <StudioLoader />
      </main>
    </div>
  );
}
