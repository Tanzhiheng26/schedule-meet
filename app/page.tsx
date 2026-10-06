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
          Invites and daily reminders are emailed for you. To book the meeting, the app writes a prompt that you paste
          into ChatGPT Enterprise, which creates it in <strong>your</strong> Outlook calendar.
        </p>
      </section>
      <CreateEventForm today={today} />
    </div>
  );
}
