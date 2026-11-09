import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
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
    <AppShell user={{ username: user.username, role: user.role, persona: user.persona }}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="border-b border-line px-6 py-3">
          <h1 className="font-display text-lg font-semibold">Order pipeline</h1>
          <p className="text-xs text-ink-soft">
            Escrow lifecycle per order — created → authorized → delivered →
            captured. Overdue orders surface automatically.
          </p>
        </header>
        <main className="min-h-0 flex-1">
          <Pipeline role={user.role} />
        </main>
      </div>
    </AppShell>
  );
}
