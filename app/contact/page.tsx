"use client";
import { useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function validateEmail(e: string) {
    return /\S+@\S+\.\S+/.test(e);
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    setSuccess("");
    if (!name.trim()) return setError("Please enter your name.");
    if (!validateEmail(email)) return setError("Please enter a valid email.");
    if (!message.trim()) return setError("Please enter a message.");
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Server error");
      } else {
        setSuccess("Message sent — thank you!");
        setName("");
        setEmail("");
        setMessage("");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Contact</h1>
      <p>If you have questions or feedback, send a message below.</p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, maxWidth: 600 }}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Message
          <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <div>
          <button type="submit" disabled={loading}>{loading ? "Sending…" : "Send message"}</button>
        </div>
        {error ? <p style={{ color: "red" }}>{error}</p> : null}
        {success ? <p style={{ color: "green" }}>{success}</p> : null}
      </form>
    </main>
  );
}
