"use client";
import React from "react";

type User = { id: number; email: string; role: string };

const mockUsers: User[] = [
  { id: 1, email: "alice@example.com", role: "user" },
  { id: 2, email: "bob@example.com", role: "admin" },
  { id: 3, email: "carol@example.com", role: "user" },
];

export default function UsersTable() {
  return (
    <div style={{ border: "1px solid #ddd", padding: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>ID</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>Email</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>Role</th>
          </tr>
        </thead>
        <tbody>
          {mockUsers.map((u) => (
            <tr key={u.id}>
              <td style={{ padding: "6px 0" }}>{u.id}</td>
              <td style={{ padding: "6px 0" }}>{u.email}</td>
              <td style={{ padding: "6px 0" }}>{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 12, color: "#666" }}>Placeholder users table — replace with real data source.</p>
    </div>
  );
}
