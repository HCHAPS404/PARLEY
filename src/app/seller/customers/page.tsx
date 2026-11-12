import { SellerCustomers } from "@/components/seller-customers";
import { PageHeader } from "@/components/page-header";

export default function SellerCustomersPage() {
  return (
    <>
      <PageHeader title="hdr.sellerCustomers" sub="hdr.sellerCustomersSub" />
      <SellerCustomers />
    </>
  );
}
