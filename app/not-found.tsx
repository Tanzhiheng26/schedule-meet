import Link from "next/link";

export default function NotFound() {
  return (
    <div className="stack">
      <h1>Link not found</h1>
      <p className="muted">This event link is invalid or the event was deleted.</p>
      <p>
        <Link href="/">Create a new event</Link>
      </p>
    </div>
  );
}
