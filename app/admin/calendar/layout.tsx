import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendar | After Hours",
  description: "View and manage game bookings on the calendar.",
};

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
