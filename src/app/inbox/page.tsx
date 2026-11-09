import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { InboxPanel } from "@/components/inbox";

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <AuthedInbox />
    </Suspense>
  );
}

async function AuthedInbox() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <AppShell user={{ username: user.username, role: user.role }}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="border-b border-line px-6 py-3">
          <h1 className="font-display text-lg font-semibold">Approvals</h1>
          <p className="text-xs text-ink-soft">
            The agent prepares — you decide. Deliveries, reorders, and anything needing a human.
          </p>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <InboxPanel role={user.role} />
        </main>
      </div>
    </AppShell>
  );
}
