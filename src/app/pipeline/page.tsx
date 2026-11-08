import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { Pipeline } from "@/components/pipeline";

export default function PipelinePage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <AuthedPipeline />
    </Suspense>
  );
}

async function AuthedPipeline() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-stone-200 px-6 py-3">
        <div>
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">
            ← Parley
          </Link>
          <h1 className="font-display text-lg font-semibold text-stone-900">
            Order pipeline
          </h1>
          <p className="text-xs text-stone-500">
            Escrow lifecycle per order — created → authorized → delivered →
            captured. Overdue orders surface automatically.
          </p>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <Pipeline />
      </main>
    </div>
  );
}
