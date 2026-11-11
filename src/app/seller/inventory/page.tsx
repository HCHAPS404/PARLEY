import { SellerDashboard } from "@/components/seller";
import { PageHeader } from "@/components/page-header";

export default function SellerInventoryPage() {
  return (
    <>
      <PageHeader title="hdr.sellerInventory" sub="hdr.sellerInventorySub" />
      <SellerDashboard view="inventory" />
    </>
  );
}
