import PaymentsDashboard from "@/components/payments/PaymentsDashboard";

export const metadata = {
  title: "Payments",
};

export default function StaffPaymentsPage() {
  return <PaymentsDashboard role="STAFF" />;
}
