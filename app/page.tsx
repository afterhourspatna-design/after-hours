import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user as any)?.role;
  if (role === "ADMIN") redirect("/admin/dashboard");
  if (role === "STAFF") redirect("/staff/dashboard");
  if (role === "CUSTOMER") redirect("/customer/bookings");
  redirect("/login");
}
