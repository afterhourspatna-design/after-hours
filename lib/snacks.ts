import { prisma } from "@/lib/prisma";

export interface ResolvedSnackProduct {
  id: string;
  name: string;
  price: number;
}

/**
 * Resolves a snack-menu product for an order line, given either an explicit
 * productId (picked from the catalog) or a typed productName (a "custom"
 * item). A typed name that matches an existing product (case-insensitive,
 * exact) reuses it as-is — its catalog price is never overwritten here, so a
 * different unitPrice on this line just acts as a one-off override. A name
 * with no match creates a new catalog entry, seeded with the price this line
 * is being sold at, so every snack sold ends up part of the menu over time.
 */
export async function resolveSnackProduct(input: {
  productId?: string | null;
  productName?: string | null;
  unitPrice: number;
}): Promise<ResolvedSnackProduct> {
  if (input.productId) {
    const product = await prisma.snackProduct.findUnique({ where: { id: input.productId } });
    if (!product) throw new Error("Selected product not found");
    return { id: product.id, name: product.name, price: Number(product.price) };
  }

  const name = (input.productName ?? "").trim();
  if (!name) throw new Error("A product must be selected or a name provided");

  const existing = await prisma.snackProduct.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return { id: existing.id, name: existing.name, price: Number(existing.price) };

  const created = await prisma.snackProduct.create({
    data: { name, price: input.unitPrice },
  });
  return { id: created.id, name: created.name, price: Number(created.price) };
}
