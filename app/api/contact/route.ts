import { NextResponse } from "next/server";

export type ContactMessage = { name: string; email: string; message: string; receivedAt: string };

const messages: ContactMessage[] = [];

function validateEmail(e?: string) {
  if (!e) return false;
  return /\S+@\S+\.\S+/.test(e);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<ContactMessage> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  const name = (body as any).name?.toString()?.trim() ?? "";
  const email = (body as any).email?.toString()?.trim() ?? "";
  const message = (body as any).message?.toString()?.trim() ?? "";
  if (!name) return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
  if (!validateEmail(email)) return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  if (!message) return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 });

  const record: ContactMessage = { name, email, message, receivedAt: new Date().toISOString() };
  messages.push(record);
  // For demo purposes we keep messages in-memory. In production, wire to a DB or email provider.
  return NextResponse.json({ ok: true });
}
