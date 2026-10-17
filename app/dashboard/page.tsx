import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { activityStats } from "@/lib/db";
import UsersTable from "./UsersTable";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    // Enforce server-side admin authorization
    redirect("/login");
  }

  const stats = activityStats();

  return (
    <main>
      <h1>Admin dashboard</h1>
      <p>
        Signed in as {session.email} ({session.role})
      </p>

      <section>
        <h2>Overview</h2>
        <ul>
          <li>Total users: {stats.totalUsers}</li>
          <li>Admins: {stats.admins}</li>
          <li>Active (24h): {stats.active24h}</li>
        </ul>
      </section>

      <section>
        <h2>Users</h2>
        <UsersTable />
      </section>

      <p>
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}
