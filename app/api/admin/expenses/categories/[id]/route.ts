import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.expenseCategory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    const body = await req.json();
    const { name, isActive } = body;

    const cleanedName = name ? name.trim() : undefined;

    if (cleanedName && cleanedName !== existing.name) {
      const conflict = await prisma.expenseCategory.findUnique({ where: { name: cleanedName } });
      if (conflict) {
        return NextResponse.json({ error: "Category name already exists" }, { status: 400 });
      }
    }

    const updated = await prisma.expenseCategory.update({
      where: { id },
      data: {
        name: cleanedName,
        isActive: isActive !== undefined ? !!isActive : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "UPDATE_EXPENSE_CATEGORY",
        entityType: "ExpenseCategory",
        entityId: id,
        meta: { changes: body },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT expense category error:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorRole = (session.user as any).role;
  if (actorRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const category = await prisma.expenseCategory.findUnique({ where: { id } });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    const expenseCount = await prisma.expense.count({ where: { categoryId: id } });

    if (expenseCount > 0) {
      await prisma.expenseCategory.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ message: "Category has existing expenses, so it was deactivated instead of deleted" });
    }

    await prisma.expenseCategory.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: (session.user as any).id,
        actorName: session.user.name ?? undefined,
        action: "DELETE_EXPENSE_CATEGORY",
        entityType: "ExpenseCategory",
        entityId: id,
        meta: { name: category.name },
      },
    });

    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error: any) {
    console.error("DELETE expense category error:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
