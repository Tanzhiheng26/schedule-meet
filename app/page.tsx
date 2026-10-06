import { CreateEventForm } from "@/components/CreateEventForm";

// The calendar greys out days before today, so render per request.
export const dynamic = "force-dynamic";

export default function Home() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="stack">
      <section>
        <h1>Find a time that works for everyone</h1>
        <p className="muted">
          Create an event and share personal links with participants. When everyone has replied, book the meeting.
          Invites, daily reminders, and the calendar invitation are all emailed for you.
        </p>
      </section>
      <CreateEventForm today={today} />
    </div>
  );
}
