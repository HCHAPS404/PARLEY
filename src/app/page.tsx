import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { Landing } from "@/components/landing";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="grid h-screen place-items-center text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <LandingGate />
    </Suspense>
  );
}

/** Public landing — the portal lives at /app. Nav adapts if a session exists. */
async function LandingGate() {
  const user = await getSessionUser();
  return <Landing authed={!!user} />;
}
