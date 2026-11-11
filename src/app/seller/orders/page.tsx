import { SellerDashboard } from "@/components/seller";
import { PageHeader } from "@/components/page-header";

export default function SellerOrdersPage() {
  return (
    <>
      <PageHeader title="hdr.sellerOrders" sub="hdr.sellerOrdersSub" />
      <SellerDashboard view="orders" />
    </>
  );
}
