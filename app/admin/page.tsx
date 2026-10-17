import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import UsersTable from "./users/Table";

export default async function AdminPage() {
  const session = await getSession();
  // Require a signed-in admin; fall back to login for non-authenticated users.
  if (!session) redirect("/login");

  return (
    <main>
      <h1>Admin Dashboard</h1>
      <section>
        <h2>Overview</h2>
        <ul>
          <li>Total users: 123 (placeholder)</li>
          <li>Active sessions: 5 (placeholder)</li>
          <li>Site visits (24h): 1,234 (placeholder)</li>
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
