import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { MessageSquare, User, CalendarDays } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

export default async function AdminFeedbackPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const feedback = await prisma.feedback.findMany({
    include: {
      user: { select: { name: true, phone: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Workspace / Feedback</p>
        <h1 className="text-xl font-bold text-white mt-1">Customer Feedback</h1>
        <p className="text-sm text-zinc-500 mt-1 font-medium">
          Review feedback submitted from the customer portal.
        </p>
      </div>

      {feedback.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={MessageSquare}
            title="No feedback yet"
            description="Customer feedback submissions will appear here."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {feedback.map((item) => (
            <article key={item.id} className="glass-card p-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <MessageSquare className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    <h2 className="truncate">{item.title}</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {item.user?.name ?? "Unknown user"}
                    </span>
                    {item.user?.phone && <span>{item.user.phone}</span>}
                    {item.user?.email && <span>{item.user.email}</span>}
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs text-zinc-500 flex-shrink-0">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {format(item.createdAt, "dd MMM yyyy, hh:mm a")}
                </div>
              </div>

              <p className="text-sm leading-6 text-zinc-300 whitespace-pre-wrap">{item.description}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
