import Link from "next/link";
import { Logo } from "@/components/brand";

export const instant = false;

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      <div className="text-center">
        <Logo className="mx-auto h-10 w-10 text-accent/60" />
        <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-2 text-[13px] text-ink-soft">
          That route doesn&apos;t exist in Parley.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-strong"
        >
          Back to the agent
        </Link>
      </div>
    </div>
  );
}
