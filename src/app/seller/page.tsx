import { SellerDashboard } from "@/components/seller";
import { PageHeader } from "@/components/page-header";

export default function SellerPage() {
  return (
    <>
      <PageHeader title="hdr.seller" sub="hdr.sellerSub" />
      <SellerDashboard view="overview" />
    </>
  );
}
