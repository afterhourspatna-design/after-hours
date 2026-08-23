import { auth } from "@/auth";
import { redirect } from "next/navigation";
import TournamentsDashboard from "@/components/tournaments/TournamentsDashboard";

export default async function TournamentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role;
  if (!["ADMIN", "STAFF"].includes(role)) redirect("/login");

  return <TournamentsDashboard />;
}
