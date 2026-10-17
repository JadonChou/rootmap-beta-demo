import { getSession } from "@/lib/auth";

export default async function StatusPage() {
  const session = await getSession();
  const email = session?.email ?? "Anonymous";
  return (
    <main>
      <h1>Status</h1>
      <p>{email}</p>
    </main>
  );
}
