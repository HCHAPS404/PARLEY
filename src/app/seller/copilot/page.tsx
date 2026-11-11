import { SellerDashboard } from "@/components/seller";
import { PageHeader } from "@/components/page-header";

export default function SellerCopilotPage() {
  return (
    <>
      <PageHeader title="hdr.sellerCopilot" sub="hdr.sellerCopilotSub" />
      <SellerDashboard view="copilot" />
    </>
  );
}
