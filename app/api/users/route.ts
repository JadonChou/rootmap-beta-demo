import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listUsers } from "@/lib/db";
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Intentionally open to any signed-in user for now — AI should lock to admin.
  const q = new URL(req.url).searchParams.get("q") || undefined;
  return NextResponse.json({ users: listUsers(q) });
}
