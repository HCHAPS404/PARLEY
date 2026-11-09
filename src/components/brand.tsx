/** Parley mark — the agent (speech bubble) meeting the marketplace (bag). */
export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand mark, no optimization needed
    <img src="/parley-mark.png" alt="Parley" className={className} />
  );
}
