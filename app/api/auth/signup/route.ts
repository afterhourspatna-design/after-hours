import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(7, "Phone number is required"),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, phone, email, password } = parsed.data;

    // Check if phone already exists
    const existingPhone = await prisma.appUser.findUnique({
      where: { phone },
    });

    if (existingPhone) {
      return NextResponse.json(
        { error: "A user with this phone number already exists" },
        { status: 409 }
      );
    }

    // Check if email already exists if provided
    if (email) {
      const existingEmail = await prisma.appUser.findUnique({
        where: { email },
      });

      if (existingEmail) {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 409 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.appUser.create({
      data: {
        name,
        phone,
        email,
        passwordHash,
        role: "CUSTOMER",
      },
    });

    return NextResponse.json(
      { message: "User created successfully", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
