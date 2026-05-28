import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import CustomerNav from "@/components/layout/CustomerNav";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role;
  if (!["ADMIN", "CUSTOMER"].includes(role)) redirect("/login");

  const featureOn = process.env.NEXT_PUBLIC_FEATURE_CUSTOMER_PORTAL === "true";
  if (!featureOn && role !== "ADMIN") redirect("/login");

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <CustomerNav userName={session.user.name ?? "Customer"} />
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <div className="page-enter">{children}</div>
      </main>
      <Link
        href="/customer/feedback"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-violet-950/40 transition-all hover:bg-violet-500 active:scale-95"
      >
        <MessageSquare className="w-4 h-4" />
        Feedback
      </Link>
    </div>
  );
}
