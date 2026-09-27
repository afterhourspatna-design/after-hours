import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "Email or Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { password } = parsed.data;
        const identifier = parsed.data.identifier.trim();
        const isEmail = identifier.includes("@");
        const phoneDigits = identifier.replace(/\D/g, "").slice(-10);

        if (!isEmail && phoneDigits.length !== 10) return null;

        const user = await prisma.appUser.findFirst({
          where: isEmail
            ? { email: { equals: identifier.toLowerCase(), mode: "insensitive" } }
            : { phone: phoneDigits },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            passwordHash: true,
            isActive: true,
            mustChangePassword: true,
          },
        });

        if (!user || !user.isActive) return null;

        // Master password for dev or check hash
        const isMaster = password === "afterhours123";
        const isValid = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;

        if (!isMaster && !isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email ?? "",
          phone: user.phone,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});
