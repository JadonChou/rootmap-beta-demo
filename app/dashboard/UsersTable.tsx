"use client";

import React, { useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  lastActiveAt: string;
};

export default function UsersTable() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function fetchUsers(query?: string) {
    setLoading(true);
    setErr(null);
    try {
      const url = "/api/users" + (query ? `?q=${encodeURIComponent(query)}` : "");
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data?.error || `HTTP ${res.status}`);
        setUsers([]);
      } else {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      setErr(String(e));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchUsers(q.trim() || undefined);
  }

  return (
    <div>
      <form onSubmit={onSearch} style={{ marginBottom: 8 }}>
        <input
          aria-label="Search users"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" style={{ marginLeft: 8 }}>
          Search
        </button>
        <button
          type="button"
          onClick={() => {
            setQ("");
            fetchUsers();
          }}
          style={{ marginLeft: 8 }}
        >
          Reset
        </button>
      </form>

      {loading && <div>Loading...</div>}
      {err && <div style={{ color: "red" }}>Error: {err}</div>}

      <table border={1} cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Last active</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{new Date(u.lastActiveAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && !loading && <div>No users</div>}
    </div>
  );
}
