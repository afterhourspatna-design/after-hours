import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const feedbackSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId: (session.user as any).id ?? null,
      title: parsed.data.title,
      description: parsed.data.description,
    },
  });

  return NextResponse.json(feedback, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  const userId = (session.user as any).id;

  const feedback = await prisma.feedback.findMany({
    where: role === "ADMIN" ? {} : { userId },
    include: { user: { select: { name: true, phone: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ feedback });
}
