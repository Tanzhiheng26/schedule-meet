import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { saveAvailability } from "@/app/actions";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import { Heatmap } from "@/components/Heatmap";
import { purgeExpiredEvents } from "@/lib/cleanup";
import { prisma } from "@/lib/db";
import { buildGrid, groupBySlot } from "@/lib/slots";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your availability · schedule-meet", robots: { index: false } };

export default async function ParticipantPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await purgeExpiredEvents();
  const participant = await prisma.participant.findUnique({
    where: { token },
    include: {
      event: {
        include: {
          participants: { select: { id: true, availability: { select: { slotStart: true } } } },
        },
      },
    },
  });
  if (!participant) notFound();

  const { event } = participant;
  const grid = buildGrid(event);
  const bySlot = groupBySlot(
    event.participants.flatMap((p) => p.availability.map((a) => ({ participantId: p.id, slotStart: a.slotStart }))),
  );
  const mine = Object.entries(bySlot)
    .filter(([, ids]) => ids.includes(participant.id))
    .map(([iso]) => iso);

  return (
    <div className="stack">
      <section>
        <h1>{event.title}</h1>
        <p className="muted">
          Hi {participant.name}. {event.hostName} is scheduling a {event.durationMin}-minute meeting.
          {!participant.required && " Your attendance is optional, but it helps to know when you're free."}
        </p>
        {event.description && <p>{event.description}</p>}
      </section>

      <section className="card">
        <h2>When are you free?</h2>
        <p className="muted">
          Click or drag to mark the times you&apos;re free, then save. Times are shown in <strong>{event.timezone}</strong>
          .
        </p>
        <AvailabilityEditor grid={grid} initial={mine} save={saveAvailability.bind(null, token)} />
      </section>

      <section className="card">
        <h2>Everyone so far</h2>
        <Heatmap grid={grid} bySlot={bySlot} total={event.participants.length} />
      </section>
    </div>
  );
}
