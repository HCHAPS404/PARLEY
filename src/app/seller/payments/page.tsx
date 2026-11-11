import { SellerPayments } from "@/components/seller-payments";
import { PageHeader } from "@/components/page-header";

export default function SellerPaymentsPage() {
  return (
    <>
      <PageHeader title="hdr.sellerPayments" sub="hdr.sellerPaymentsSub" />
      <SellerPayments />
    </>
  );
}
