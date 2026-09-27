import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { resolveReferrer } from "@/lib/referral";

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(7, "Phone number is required"),
  email: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z.string().email().optional().nullable()
  ),
  password: z.string().min(6, "Password must be at least 6 characters"),
  referredBy: z.string().optional().nullable(),
});

export type SignupInput = z.infer<typeof signupSchema>;

type SignupResult =
  | { ok: true; user: { id: string } }
  | { ok: false; error: string; status: number };

/** Phone/email conflict check shared by the plain and OTP-verified signup paths,
 * so both surface the exact same messages (including the "already registered by
 * our staff, please log in" distinction for unclaimed pre-registered accounts). */
export async function checkSignupConflicts(phone: string, email: string | null | undefined): Promise<{ error: string; status: number } | null> {
  const existingPhone = await prisma.appUser.findUnique({ where: { phone } });
  if (existingPhone) {
    const isUnclaimedPreRegistered = existingPhone.role === "CUSTOMER" && existingPhone.mustChangePassword;
    return {
      error: isUnclaimedPreRegistered
        ? "This phone number was already registered by our staff. Please log in with the password you were given."
        : "A user with this phone number already exists. Please log in instead.",
      status: 409,
    };
  }

  if (email) {
    const existingEmail = await prisma.appUser.findUnique({ where: { email } });
    if (existingEmail) {
      return { error: "A user with this email already exists", status: 409 };
    }
  }

  return null;
}

/** Re-checks conflicts (race-condition safety — time may have passed since an
 * earlier check, e.g. while an OTP was being entered), resolves the optional
 * referrer, and creates the CUSTOMER account. */
export async function createCustomerAccount(data: SignupInput): Promise<SignupResult> {
  const { name, phone, email, password, referredBy } = data;

  const conflict = await checkSignupConflicts(phone, email);
  if (conflict) return { ok: false, ...conflict };

  let referrer: { id: string; phone: string } | null = null;
  try {
    referrer = await resolveReferrer(referredBy);
  } catch (err: any) {
    return { ok: false, error: err.message, status: 400 };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.appUser.create({
    data: {
      name,
      phone,
      email,
      passwordHash,
      role: "CUSTOMER",
      referredById: referrer?.id ?? null,
      referredByPhone: referrer?.phone ?? null,
    },
  });

  return { ok: true, user };
}
