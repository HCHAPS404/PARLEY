/** Parley mark — the agent (speech bubble) meeting the marketplace (bag). */
export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- vector brand mark scales losslessly
    <img src="/parley-mark.svg" alt="Parley" className={className} />
  );
}
