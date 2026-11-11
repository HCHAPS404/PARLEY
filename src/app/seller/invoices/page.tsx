import { SellerInvoices } from "@/components/seller-payments";
import { PageHeader } from "@/components/page-header";

export default function SellerInvoicesPage() {
  return (
    <>
      <PageHeader title="hdr.sellerInvoices" sub="hdr.sellerInvoicesSub" />
      <SellerInvoices />
    </>
  );
}
