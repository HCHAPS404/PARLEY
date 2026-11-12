import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { MessagesPanel } from "@/components/messages";
import { PageHeader } from "@/components/page-header";

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <AuthedMessages />
    </Suspense>
  );
}

async function AuthedMessages() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <AppShell user={{ username: user.username, role: user.role, persona: user.persona }}>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title="hdr.messages" sub="hdr.messagesSub" />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MessagesPanel persona={user.persona === "seller" ? "seller" : "buyer"} />
        </main>
      </div>
    </AppShell>
  );
}
