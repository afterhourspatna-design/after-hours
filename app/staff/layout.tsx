import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) redirect("/login");

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <Sidebar role="STAFF" userName={session.user.name ?? "Staff"} userEmail={session.user.email ?? ""} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto custom-scroll">
          <div className="page-enter p-8 max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
