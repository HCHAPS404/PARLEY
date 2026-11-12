import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { MySellers } from "@/components/my-sellers";
import { PageHeader } from "@/components/page-header";

export default function SellersPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <AuthedSellers />
    </Suspense>
  );
}

async function AuthedSellers() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.persona === "seller") redirect("/seller");
  return (
    <AppShell user={{ username: user.username, role: user.role, persona: user.persona }}>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title="hdr.sellers" sub="hdr.sellersSub" />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <MySellers />
        </main>
      </div>
    </AppShell>
  );
}
