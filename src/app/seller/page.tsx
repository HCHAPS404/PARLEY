import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { SellerDashboard } from "@/components/seller";

export default function SellerPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <AuthedSeller />
    </Suspense>
  );
}

async function AuthedSeller() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <AppShell user={{ username: user.username, role: user.role, persona: user.persona }}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="border-b border-line px-6 py-3">
          <h1 className="font-display text-lg font-semibold">Your store</h1>
          <p className="text-xs text-ink-soft">
            Your agent sells while you sleep — catalog, negotiations, and closed deals.
          </p>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <SellerDashboard />
        </main>
      </div>
    </AppShell>
  );
}
