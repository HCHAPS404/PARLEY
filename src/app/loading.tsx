import { Loader2 } from "lucide-react";
import { Logo } from "@/components/brand";

export const instant = false;

export default function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Logo className="h-10 w-10 opacity-50" />
        <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
      </div>
    </div>
  );
}
