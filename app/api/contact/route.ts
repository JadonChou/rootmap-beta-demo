import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, message } = body || {};
    if (!name || !email || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    // basic sanitization/validation
    if (typeof name !== "string" || typeof email !== "string" || typeof message !== "string") {
      return NextResponse.json({ error: "Invalid field types" }, { status: 400 });
    }
    // simple email check
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // For this demo app we don't forward messages — just log to the server console.
    // Real implementations could enqueue/send emails or persist to a DB.
    // eslint-disable-next-line no-console
    console.log("Contact submission:", { name, email, message });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
