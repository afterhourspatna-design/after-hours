import { auth } from "@/auth";
import { redirect } from "next/navigation";

type Role = "ADMIN" | "STAFF" | "CUSTOMER";

export async function requireAuth(allowedRoles?: Role[]) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role as Role;
  if (allowedRoles && !allowedRoles.includes(role)) {
    const home: Record<Role, string> = {
      ADMIN: "/admin/dashboard",
      STAFF: "/staff/dashboard",
      CUSTOMER: "/customer/bookings",
    };
    redirect(home[role]);
  }

  return { session, role, userId: session.user.id as string };
}
