import { NextResponse } from "next/server";
import { COOKIE, encodeSession } from "@/lib/auth";
import { listUsers } from "@/lib/db";
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  const user = listUsers().find((u) => u.email.toLowerCase() === email);
  if (!user) return NextResponse.json({ error: "Unknown user" }, { status: 401 });
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(COOKIE, encodeSession({ userId: user.id, email: user.email, role: user.role }), {
    httpOnly: true,
    path: "/",
  });
  return res;
}
