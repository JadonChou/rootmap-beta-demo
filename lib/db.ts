export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  lastActiveAt: string;
};

const users: User[] = [
  {
    id: "u1",
    email: "admin@demo.local",
    name: "Ada Admin",
    role: "admin",
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: "u2",
    email: "bob@demo.local",
    name: "Bob Builder",
    role: "user",
    lastActiveAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "u3",
    email: "cara@demo.local",
    name: "Cara Creator",
    role: "user",
    lastActiveAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

export function listUsers(query?: string): User[] {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return [...users];
  return users.filter(
    (u) =>
      u.email.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.role.includes(q),
  );
}

export function getUser(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function activityStats() {
  const now = Date.now();
  const active24h = users.filter(
    (u) => now - new Date(u.lastActiveAt).getTime() < 86400000,
  ).length;
  return {
    totalUsers: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    active24h,
  };
}
