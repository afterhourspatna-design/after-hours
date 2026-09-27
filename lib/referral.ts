import { prisma } from "@/lib/prisma";

/**
 * Resolves a "referred by" phone number to an existing AppUser, using the same
 * matching rule as the booking flow's referrer lookup (app/api/bookings/route.ts).
 * Returns null if the input is empty/whitespace-only (referral is optional).
 * Throws if a non-empty input doesn't match anyone, so callers can 400 consistently.
 */
export async function resolveReferrer(referredByPhone: string | null | undefined): Promise<{ id: string; phone: string } | null> {
  if (!referredByPhone || !referredByPhone.trim()) return null;

  const cleanedPhone = referredByPhone.replace(/\D/g, "");
  if (!cleanedPhone) return null;

  const referrer = await prisma.appUser.findFirst({
    where: {
      OR: [
        { phone: referredByPhone },
        { phone: { contains: cleanedPhone } },
      ],
    },
    select: { id: true, phone: true },
  });

  if (!referrer) {
    throw new Error("Referrer phone number not found in database. Please register the referring customer first.");
  }

  return referrer;
}
