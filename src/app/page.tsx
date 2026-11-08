import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { ChatArea } from "@/components/chat";
import { Logo } from "@/components/brand";
import { ShieldCheck, Landmark, Radio } from "lucide-react";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="grid h-screen place-items-center text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <AuthedHome />
    </Suspense>
  );
}

async function AuthedHome() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-card md:flex">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
          <Logo className="h-7 w-7 text-accent" />
          <div>
            <div className="font-display text-[15px] font-semibold tracking-tight">
              Parley
            </div>
            <div className="text-[11px] text-ink-soft">
              Procurement that negotiates
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 p-3 text-sm">
          <span className="rounded-md bg-accent-mist px-3 py-2 font-medium text-accent-strong">
            Agent
          </span>
          <a
            href="/analytics"
            className="rounded-md px-3 py-2 text-ink-soft hover:bg-paper"
          >
            Analytics
          </a>
          <a
            href="/pipeline"
            className="rounded-md px-3 py-2 text-ink-soft hover:bg-paper"
          >
            Pipeline
          </a>
        </nav>

        <div className="mt-auto space-y-2 border-t border-line p-4 text-[11px] text-ink-soft">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            Agentic escrow — held until delivery
          </div>
          <div className="flex items-center gap-2">
            <Landmark className="h-3.5 w-3.5 text-accent" />
            PayPal sandbox — no real money
          </div>
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-accent" />
            Every action audited
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <ChatArea user={{ username: user.username, role: user.role }} />
      </main>
    </div>
  );
}
