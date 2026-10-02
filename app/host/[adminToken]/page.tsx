import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { chooseSlot, markInvitesSent, markReminderSent, toggleRequired } from "@/app/actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CopyButton } from "@/components/CopyButton";
import { Heatmap } from "@/components/Heatmap";
import { PromptCard } from "@/components/PromptCard";
import { getBaseUrl } from "@/lib/baseUrl";
import { prisma } from "@/lib/db";
import { invitePrompt, meetingPrompt, participantLink, reminderPrompt } from "@/lib/prompts";
import { addMinutes, availableFor, buildGrid, formatSlot, groupBySlot, rankSlots } from "@/lib/slots";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Host dashboard · schedule-meet", robots: { index: false } };

export default async function HostPage({ params }: { params: Promise<{ adminToken: string }> }) {
  const { adminToken } = await params;
  const event = await prisma.event.findUnique({
    where: { adminToken },
    include: {
      participants: { orderBy: { name: "asc" }, include: { availability: { select: { slotStart: true } } } },
    },
  });
  if (!event) notFound();

  const baseUrl = await getBaseUrl();
  const tz = event.timezone;
  const { participants } = event;
  const grid = buildGrid(event);
  const bySlot = groupBySlot(
    participants.flatMap((p) => p.availability.map((a) => ({ participantId: p.id, slotStart: a.slotStart }))),
  );
  const names = Object.fromEntries(participants.map((p) => [p.id, p.name]));
  const pending = participants.filter((p) => !p.respondedAt);
  const pendingRequired = pending.filter((p) => p.required);
  const requiredIds = new Set(participants.filter((p) => p.required).map((p) => p.id));
  const requiredTotal = requiredIds.size;
  const optionalTotal = participants.length - requiredTotal;
  const ranked = rankSlots(grid, bySlot, event.slotMinutes, event.durationMin, requiredIds);
  const nameList = (ps: { name: string }[]) => ps.map((p) => p.name).join(", ");
  const missingFrom = (ids: ReadonlySet<string>) => ({
    required: participants.filter((p) => p.required && !ids.has(p.id)),
    optional: participants.filter((p) => !p.required && !ids.has(p.id)),
  });

  // A time can be picked once every required participant has responded. The best one is preselected.
  const canSchedule = pendingRequired.length === 0;
  const chosenStart = canSchedule ? (event.finalSlotStart?.toISOString() ?? ranked[0]?.start) : undefined;
  const chosen = chosenStart
    ? {
        start: chosenStart,
        end: addMinutes(chosenStart, event.durationMin),
        available: new Set(availableFor(grid, bySlot, chosenStart, event.slotMinutes, event.durationMin)),
      }
    : undefined;

  return (
    <div className="stack">
      <AutoRefresh />
      <section>
        <h1>{event.title}</h1>
        <p className="muted">
          {event.durationMin}-minute meeting · times in {tz}
        </p>
        <p className="notice">
          🔒 This is your private host page. Bookmark it; anyone with this link can manage the event.{" "}
          <CopyButton text={`${baseUrl}/host/${adminToken}`} label="Copy host link" />
        </p>
      </section>

      {/* Step 1: invites */}
      {!event.invitesSentAt ? (
        <PromptCard
          title="Step 1 · Send the invites"
          tone="attention"
          prompt={invitePrompt(event, participants, baseUrl)}
          done={{ label: "I've sent the invites", action: markInvitesSent.bind(null, adminToken) }}
        >
          <p className="muted">
            Copy this prompt into ChatGPT Enterprise. It sends each participant their personal link from your Outlook.
            Then mark the invites as sent to get the reminder prompt.
          </p>
        </PromptCard>
      ) : (
        <details className="card">
          <summary>
            ✅ Invites sent {formatSlot(event.invitesSentAt.toISOString(), tz)}. Show the invite prompt again
          </summary>
          <textarea className="prompt" readOnly rows={10} value={invitePrompt(event, participants, baseUrl)} />
        </details>
      )}

      {/* Responses + reminders */}
      <section className="card">
        <h2>
          Responses{" "}
          <span className="muted">
            {requiredTotal - pendingRequired.length}/{requiredTotal} required
            {optionalTotal > 0 && ` · ${optionalTotal - (pending.length - pendingRequired.length)}/${optionalTotal} optional`}
          </span>
        </h2>
        <ul className="people">
          {participants.map((p) => (
            <li key={p.id}>
              <span>{p.respondedAt ? "✅" : "⏳"}</span>
              <span>
                <strong>{p.name}</strong> <span className="muted">{p.email}</span>
              </span>
              <span className="pill" data-variant={p.required ? undefined : "optional"}>
                {p.required ? "Required" : "Optional"}
              </span>
              <form action={toggleRequired.bind(null, adminToken, p.id)}>
                <button className="small">{p.required ? "Make optional" : "Make required"}</button>
              </form>
              <CopyButton text={participantLink(baseUrl, p.token)} label="Copy link" className="small" />
            </li>
          ))}
        </ul>
        {pending.length === 0 ? (
          <p className="success">🎉 Everyone has responded.</p>
        ) : (
          <>
            {canSchedule && (
              <p className="success">✅ All required participants have responded. You can pick a time.</p>
            )}
            <p className="muted">Waiting on {nameList(pending)}.</p>
          </>
        )}
      </section>

      {event.invitesSentAt && pending.length > 0 && (
        <PromptCard
          title={`Send a reminder · ${pending.length} haven't responded`}
          prompt={reminderPrompt(event, pending, baseUrl)}
          done={{ label: "I've sent the reminders", action: markReminderSent.bind(null, adminToken) }}
        >
          <p className="muted">
            This prompt includes only the people who haven&apos;t responded yet. Send it whenever you like.
            {event.lastReminderAt && ` Last reminder sent ${formatSlot(event.lastReminderAt.toISOString(), tz)}.`}
          </p>
        </PromptCard>
      )}

      {/* Step 2: pick a slot */}
      <section className="card">
        <h2>Best times</h2>
        {!canSchedule && (
          <p className="muted">
            You can pick a time once all required participants have responded. Still waiting on{" "}
            {nameList(pendingRequired)}. If someone can&apos;t respond, make them optional.
          </p>
        )}
        {ranked.length === 0 ? (
          <p className="muted">No availability yet.</p>
        ) : (
          <ol className="slots">
            {ranked.map((r) => {
              const isChosen = r.start === chosen?.start;
              const missing = missingFrom(new Set(r.participantIds));
              return (
                <li key={r.start} data-chosen={isChosen || undefined}>
                  <span>
                    <strong>{formatSlot(r.start, tz)}</strong>–{formatSlot(r.end, tz, "HH:mm")}
                  </span>
                  <span className="muted">
                    {requiredTotal - missing.required.length}/{requiredTotal} required
                    {optionalTotal > 0 && ` · ${optionalTotal - missing.optional.length}/${optionalTotal} optional`}
                  </span>
                  {isChosen ? (
                    <span className="pill">Selected</span>
                  ) : (
                    canSchedule && (
                      <form action={chooseSlot.bind(null, adminToken, r.start)}>
                        <button className="small">Use this time</button>
                      </form>
                    )
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Step 2: book */}
      {chosen && (
        <PromptCard
          title={`Step 2 · Book the meeting: ${formatSlot(chosen.start, tz)}–${formatSlot(chosen.end, tz, "HH:mm")}`}
          tone="attention"
          prompt={meetingPrompt(event, chosen, participants)}
        >
          <p className="muted">Paste this into ChatGPT to create the meeting and invite everyone.</p>
          {(() => {
            const missing = missingFrom(chosen.available);
            return (
              <>
                {missing.required.length > 0 && (
                  <p className="error">Required but not free at this time: {nameList(missing.required)}</p>
                )}
                {missing.optional.length > 0 && (
                  <p className="muted">Optional and not free at this time: {nameList(missing.optional)}</p>
                )}
              </>
            );
          })()}
        </PromptCard>
      )}

      <section className="card">
        <h2>Group availability</h2>
        <p className="muted">Darker means more people are free. Hover over a cell to see who.</p>
        <Heatmap grid={grid} bySlot={bySlot} total={participants.length} names={names} />
      </section>
    </div>
  );
}
