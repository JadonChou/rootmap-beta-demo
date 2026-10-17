"use client";
import { useState } from "react";
export default function LoginPage() {
  const [email, setEmail] = useState("admin@demo.local");
  const [error, setError] = useState("");
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      setError((await res.json()).error || "Login failed");
      return;
    }
    window.location.href = "/dashboard";
  }
  return (
    <main>
      <h1>Login</h1>
      <p>Use admin@demo.local or bob@demo.local</p>
      <form onSubmit={onSubmit}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit">Sign in</button>
      </form>
      {error ? <p>{error}</p> : null}
    </main>
  );
}
