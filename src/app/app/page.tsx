import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ChatArea } from "@/components/chat";

export default function AppHome() {
  return (
    <Suspense
      fallback={
        <div className="grid h-screen place-items-center text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <AuthedApp />
    </Suspense>
  );
}

async function AuthedApp() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell user={{ username: user.username, role: user.role }}>
      <ChatArea user={{ username: user.username, role: user.role }} />
    </AppShell>
  );
}
