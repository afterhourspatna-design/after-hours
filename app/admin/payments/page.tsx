import PaymentsDashboard from "@/components/payments/PaymentsDashboard";

export const metadata = {
  title: "Payments",
};

export default function AdminPaymentsPage() {
  return <PaymentsDashboard role="ADMIN" />;
}
