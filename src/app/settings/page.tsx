import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { SettingsInner } from "@/components/settings-inner";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <AuthedSettings />
    </Suspense>
  );
}

async function AuthedSettings() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <AppShell user={{ username: user.username, role: user.role }}>
      <SettingsInner user={{ username: user.username, email: user.email, role: user.role }} />
    </AppShell>
  );
}
