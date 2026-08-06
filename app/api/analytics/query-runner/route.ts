import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Helper function to serialize BigInt, Decimal, and Date objects for JSON output
function serializeRow(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (typeof obj === "object") {
    // Handle Decimal or objects with toString/toNumber
    if ("d" in obj && "s" in obj && "e" in obj) {
      return Number(obj);
    }
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    if (Array.isArray(obj)) {
      return obj.map(serializeRow);
    }
    const serialized: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "bigint") {
        serialized[key] = Number(val);
      } else if (val && typeof val === "object" && "d" in val && "s" in val && "e" in val) {
        serialized[key] = Number(val);
      } else if (val instanceof Date) {
        serialized[key] = val.toISOString();
      } else {
        serialized[key] = serializeRow(val);
      }
    }
    return serialized;
  }
  return obj;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Please provide a valid SQL query" }, { status: 400 });
    }

    const trimmed = query.trim();
    
    // Security check: Block hazardous operations
    const forbiddenKeywords = ["DROP DATABASE", "DROP TABLE", "TRUNCATE", "DELETE FROM app_users"];
    for (const kw of forbiddenKeywords) {
      if (trimmed.toUpperCase().includes(kw)) {
        return NextResponse.json({ 
          error: `Execution blocked: Hazardous operation '${kw}' is not allowed in Live Query Runner.` 
        }, { status: 400 });
      }
    }

    const startTime = performance.now();
    const rawResults: any = await prisma.$queryRawUnsafe(trimmed);
    const endTime = performance.now();

    const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;

    let rows: any[] = [];
    let columns: string[] = [];

    if (Array.isArray(rawResults)) {
      rows = rawResults.map(serializeRow);
      if (rows.length > 0) {
        columns = Object.keys(rows[0]);
      }
    } else if (typeof rawResults === "object" && rawResults !== null) {
      const serialized = serializeRow(rawResults);
      rows = [serialized];
      columns = Object.keys(serialized);
    } else {
      rows = [{ result: rawResults }];
      columns = ["result"];
    }

    return NextResponse.json({
      success: true,
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs,
    });
  } catch (err: any) {
    console.error("SQL Query Runner Error:", err);
    return NextResponse.json({
      success: false,
      error: err?.message || "SQL Execution Error",
    }, { status: 400 });
  }
}
