import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as any).role;
    if (role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { id } = await params;

    const transaction = await prisma.prepaidTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (!transaction.creditBalanceId) {
      return NextResponse.json({ error: "Cannot delete this type of transaction" }, { status: 400 });
    }

    // Must be a top-up transaction (positive amount)
    if (Number(transaction.amount) <= 0) {
      return NextResponse.json({ error: "Only top-up transactions can be deleted" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Find the credit balance
      const creditBalance = await tx.userCreditBalance.findUnique({
        where: { id: transaction.creditBalanceId! }
      });

      if (!creditBalance) {
        throw new Error("Credit balance not found");
      }

      // 2. Calculate the deduction amount safely
      // The user requested: if they added 5000, but spent 1500 (current balance 3500),
      // we only deduct 3500 so balance doesn't go below 0.
      const currentBalance = Number(creditBalance.balance);
      const transactionAmount = Number(transaction.amount);
      
      const deductionAmount = Math.min(currentBalance, transactionAmount);

      // 3. Update the credit balance
      await tx.userCreditBalance.update({
        where: { id: creditBalance.id },
        data: { balance: { decrement: deductionAmount } },
      });

      // 4. Delete the transaction
      await tx.prepaidTransaction.delete({
        where: { id },
      });

      // 5. Delete the payment if it exists
      if (transaction.paymentId) {
        await tx.payment.delete({
          where: { id: transaction.paymentId },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/prepaid-balances/[id] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
