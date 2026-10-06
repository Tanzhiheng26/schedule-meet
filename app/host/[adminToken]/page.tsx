import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { chooseSlot, markReminderSent, sendInvites, sendReminders, toggleRequired } from "@/app/actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CopyButton } from "@/components/CopyButton";
import { Heatmap } from "@/components/Heatmap";
import { PromptCard } from "@/components/PromptCard";
import { SendButton } from "@/components/SendButton";
import { getBaseUrl } from "@/lib/baseUrl";
import { purgeExpiredEvents } from "@/lib/cleanup";
import { prisma } from "@/lib/db";
import { emailConfigured } from "@/lib/mailer";
import { meetingPrompt, participantLink, reminderPrompt } from "@/lib/prompts";
import {
  addMinutes,
  availableFor,
  buildGrid,
  formatSlot,
  groupBySlot,
  hhmm,
  rankSlots,
  REMINDER_HOUR,
} from "@/lib/slots";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Host dashboard · schedule-meet", robots: { index: false } };

export default async function HostPage({ params }: { params: Promise<{ adminToken: string }> }) {
  const { adminToken } = await params;
  await purgeExpiredEvents();
  const event = await prisma.event.findUnique({
    where: { adminToken },
    include: {
      participants: { orderBy: { name: "asc" }, include: { availability: { select: { slotStart: true } } } },
    },
  });
  if (!event) notFound();

  const baseUrl = await getBaseUrl();
  const canEmail = emailConfigured();
  const tz = event.timezone;
  const { participants } = event;
  const grid = buildGrid(event);
  const bySlot = groupBySlot(
    participants.flatMap((p) => p.availability.map((a) => ({ participantId: p.id, slotStart: a.slotStart }))),
  );
  const names = Object.fromEntries(participants.map((p) => [p.id, p.name]));
  const pending = participants.filter((p) => !p.respondedAt);
  const uninvited = participants.filter((p) => !p.invitedAt);
  const toRemind = pending.filter((p) => p.invitedAt);
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

      {/* Invites are emailed when the event is created. */}
      {uninvited.length === 0 ? (
        <p className="success">
          ✅ Invites emailed to {participants.length === 1 ? "the participant" : `all ${participants.length} participants`}.
          Replies come to you.
        </p>
      ) : (
        <section className="card prompt-card" data-tone="attention">
          <h3>
            {uninvited.length === participants.length
              ? "Invites haven't been sent"
              : `${uninvited.length} invite${uninvited.length === 1 ? "" : "s"} didn't go out`}
          </h3>
          <p className="muted">
            Not emailed yet: {nameList(uninvited)}. Try again, or use <em>Copy link</em> below to send someone their
            link yourself.
          </p>
          <SendButton label="Send invites" action={sendInvites.bind(null, adminToken)} />
        </section>
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

      {toRemind.length > 0 && (
        <PromptCard
          title={`Send a reminder · ${toRemind.length} haven't responded`}
          prompt={reminderPrompt(event, toRemind, baseUrl)}
          done={{ label: "I've sent the reminders", action: markReminderSent.bind(null, adminToken) }}
          send={canEmail ? { label: "Send reminders now", action: sendReminders.bind(null, adminToken) } : undefined}
        >
          <p className="muted">
            Reminders go only to the people who haven&apos;t responded yet.{" "}
            {canEmail && `They're emailed automatically every day at ${hhmm(REMINDER_HOUR * 60)} (${tz}). `}
            You can also send one now.
            {event.lastReminderAt && ` Last reminder sent ${formatSlot(event.lastReminderAt.toISOString(), tz)}.`}
          </p>
        </PromptCard>
      )}

      {/* Pick a slot */}
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

      {/* Book */}
      {chosen && (
        <PromptCard
          title={`Book the meeting: ${formatSlot(chosen.start, tz)}–${formatSlot(chosen.end, tz, "HH:mm")}`}
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
        <p className="muted">Darker means more people are free.</p>
        <Heatmap grid={grid} bySlot={bySlot} total={participants.length} names={names} />
      </section>
    </div>
  );
}
