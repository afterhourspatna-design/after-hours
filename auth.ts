import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.appUser.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            passwordHash: true,
            isActive: true,
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
        };
      },
    }),
  ],
});
