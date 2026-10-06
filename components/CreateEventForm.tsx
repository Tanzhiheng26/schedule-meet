"use client";

import { useActionState, useEffect, useState } from "react";
import { createEvent, type CreateEventState } from "@/app/actions";
import { MAX_DATES } from "@/lib/slots";
import { DatePicker } from "./DatePicker";

export function CreateEventForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<CreateEventState, FormData>(createEvent, {});
  const [timezone, setTimezone] = useState("UTC");

  // The event uses the host's browser time zone. Set after mount to avoid hydration mismatches.
  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  return (
    <form action={action} className="card stack">
      <input type="hidden" name="timezone" value={timezone} />
      <div className="fields">
        <label className="span-2">
          Meeting title
          <input name="title" required maxLength={200} />
        </label>
        <label className="span-2">
          Description <span className="muted">(optional; included in emails and the meeting)</span>
          <textarea name="description" rows={2} />
        </label>
        <label>
          Your name
          <input name="hostName" required autoComplete="name" />
        </label>
        <label>
          Your email
          <input name="hostEmail" type="email" required autoComplete="email" />
        </label>

        <div className="span-2 field">
          <span className="field-label">Possible days</span>
          <DatePicker name="dates" today={today} max={MAX_DATES} />
        </div>

        <label className="span-2">
          Respond by <span className="muted">(shown in the emails; daily reminders stop after this day)</span>
          <input name="respondBy" type="date" required min={today} />
        </label>

        <label>
          Earliest time
          <input name="dayStart" type="time" required defaultValue="09:00" step={900} />
        </label>
        <label>
          Latest time
          <input name="dayEnd" type="time" required defaultValue="18:00" step={900} />
        </label>
        <label>
          Meeting length
          <select name="durationMin" defaultValue="60">
            {[15, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>

        <p className="span-2 muted">
          Enter participants one per line, or paste straight from Outlook: <code>Name &lt;email&gt;; …</code>. You can
          pick a time once all <strong>required</strong> participants have responded. Optional participants are invited
          and counted but don&apos;t block scheduling.
        </p>
        <label>
          Required participants
          <textarea
            name="participants"
            rows={5}
            required
            placeholder={"Alice Tan <alice@company.com>\nbob@company.com"}
          />
        </label>
        <label>
          Optional participants
          <textarea name="optionalParticipants" rows={5} placeholder="carol@company.com" />
        </label>
      </div>

      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <button className="primary" type="submit" disabled={pending}>
          {pending ? "Creating and sending invites…" : "Create event and send invites"}
        </button>
      </div>
    </form>
  );
}
