"use client";
import React, { useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  function validate() {
    const e: { [k: string]: string } = {};
    if (!name.trim()) e.name = "Name is required";
    if (!email.trim()) e.email = "Email is required";
    // simple email check
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = "Email looks invalid";
    if (!message.trim()) e.message = "Message is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (res.ok) {
        setStatus("success");
        setName("");
        setEmail("");
        setMessage("");
      } else {
        setStatus("error");
      }
    } catch (err) {
      setStatus("error");
    }
  }

  return (
    <main>
      <h1>Contact</h1>
      <p>Send us a message — we'll get back to you shortly.</p>
      <form onSubmit={handleSubmit} style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: 8 }}>
          <label>
            Name<br />
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {errors.name && <div style={{ color: "red" }}>{errors.name}</div>}
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>
            Email<br />
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {errors.email && <div style={{ color: "red" }}>{errors.email}</div>}
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>
            Message<br />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} />
          </label>
          {errors.message && <div style={{ color: "red" }}>{errors.message}</div>}
        </div>
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "Sending…" : "Send"}
          </button>
        </div>
        {status === "success" && <div style={{ color: "green", marginTop: 8 }}>Message sent. Thank you!</div>}
        {status === "error" && <div style={{ color: "red", marginTop: 8 }}>Failed to send message. Please try again later.</div>}
      </form>
    </main>
  );
}
