import { Prisma } from "@prisma/client";

export interface RankField {
  /** Table/alias for the column, e.g. "u", "b". Omit for an unqualified column. */
  table?: string;
  column: string;
}

/**
 * Build a parameterized SQL relevance expression that scores a row:
 *   0 -> exact match (case-insensitive)
 *   1 -> prefix match (case-insensitive)
 *   2 -> substring match (also the fallback for the matched set)
 * The LOWEST score ranks first. Multiple fields are combined via LEAST so a row
 * ranks by its best-matching field.
 *
 * Column/table names are hardcoded constants (safe). The search term is always
 * passed as a bound parameter, so this is SQL-injection safe.
 */
export function relevanceScore(term: string, fields: RankField[]): Prisma.Sql {
  const termSql = Prisma.sql`${term}`;
  const perField = fields.map((f) => {
    const col = f.table
      ? Prisma.raw(`"${f.table}"."${f.column}"`)
      : Prisma.raw(`"${f.column}"`);
    return Prisma.sql`
      CASE
        WHEN lower(${col}) = lower(${termSql}) THEN 0
        WHEN lower(${termSql}) <> '' AND lower(${col}) LIKE lower(${termSql}) || '%' THEN 1
        ELSE 2
      END
    `;
  });
  if (perField.length === 1) return perField[0]!;
  return Prisma.sql`LEAST(${Prisma.join(perField, ", ")})`;
}

/**
 * Pure-JS equivalent of {@link relevanceScore}, for rows that are merged/sorted
 * in memory (e.g. the bookings + snacks union) rather than via a DB query.
 * Returns 0 (exact) / 1 (prefix) / 2 (substring-or-miss).
 */
export function scoreMatch(term: string, values: (string | null | undefined)[]): number {
  const t = term.trim().toLowerCase();
  if (!t) return 2;
  let best = 2;
  for (const raw of values) {
    if (!raw) continue;
    const v = raw.toLowerCase();
    if (v === t) return 0;
    if (v.startsWith(t) && best > 1) best = 1;
  }
  return best;
}

/** Reorder a list of rows to match a precomputed id order (preserving ranking). */
export function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const map = new Map(rows.map((r) => [r.id, r]));
  const out: T[] = [];
  for (const id of ids) {
    const r = map.get(id);
    if (r) out.push(r);
  }
  return out;
}
