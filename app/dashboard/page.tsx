import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <main>
      <h1>User dashboard</h1>
      <p>Signed in as {session.email} ({session.role})</p>
      <p><Link href="/">Home</Link></p>
    </main>
  );
}
