import { DemoGuide } from "@/components/demo-guide";

export const metadata = {
  title: "How to use Parley — judge guide",
  description:
    "Sign in as the buyer or the seller and follow a guided track — every screenshot is the live app.",
};

/** Public "how to use" — judge credentials + a scroll-guided tour of both
 * sides. No auth required: this page is the door into the demo accounts. */
export default function DemoPage() {
  return <DemoGuide />;
}
