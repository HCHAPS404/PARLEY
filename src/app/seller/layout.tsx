import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <AuthedSeller>{children}</AuthedSeller>
    </Suspense>
  );
}

async function AuthedSeller({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <AppShell user={{ username: user.username, role: user.role, persona: user.persona }}>
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </AppShell>
  );
}
