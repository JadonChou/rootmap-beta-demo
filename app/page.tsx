import Link from "next/link";
export default function Home() {
  return (
    <main>
      <h1>Rootmap Beta Demo</h1>
      <p>Disposable fullstack app for private-beta AI tests.</p>
      <ul>
        <li><Link href="/login">Login</Link></li>
        <li><Link href="/dashboard">User dashboard</Link></li>
      </ul>
    </main>
  );
}
