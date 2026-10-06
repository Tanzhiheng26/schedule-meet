# schedule-meet

A when2meet-style scheduler. The host creates an event and participants mark their availability on a grid. The app tracks who has responded and finds the best time.

**Invites** are emailed automatically from a Gmail account when the event is created (see [Email setup](#email-setup)). **Reminders** are emailed automatically every day at 9am (event time zone), starting the day after the event is created and ending on the host's **respond-by date** (or earlier, once the calendar invitation is sent), to invited participants who haven't responded. The host can also send one at any time before then. Once a time is picked, the host sends a **calendar invitation** the same way.

## How it works

1. **Create an event** (`/`): title, the specific days to consider (pick any days on a calendar), a respond-by date (shown in the emails; between today and the last possible day), daily hours, meeting length, required and optional participant emails (paste them straight from Outlook). The grid uses 30-minute slots, and times use the host's browser time zone.
2. **Host dashboard** (`/host/<secret>`, bookmark it):
   - **Invites**: each participant was emailed their personal link (with a QR code) when the event was created. If any didn't go out, the dashboard lists them with a *Send invites* button that retries only those people.
   - **Responses**: ✅/⏳ per participant, marked Required or Optional (you can switch each one). The page refreshes every 30s.
   - **Reminders**: appears while any invited participant hasn't responded. Reminders go out automatically at 9am every day from the day after creation until the respond-by date, and *Send reminders now* sends one immediately. Either way, they go only to non-responders. Reminders stop, including manual ones, after the respond-by date or once a calendar invitation has been sent, and the card is replaced by a note.
   - **Best times**: meeting slots ranked by how many required participants are free, then how many people overall. You can pick one once all required participants have responded. Optional participants never block scheduling.
   - **Book the meeting**: appears once all required participants have responded, with the best time preselected. *Send calendar invitation* emails the host and every participant a meeting request (`.ics`) that they can accept into Outlook, Gmail, or Apple Calendar. The host is the organizer, so RSVPs go to them. If you change the time and send again, it updates the same calendar entry. Optional participants are marked optional in the invitation.
3. **Participants** (`/e/<token>`): click or drag to mark free times, then save. They can come back and edit.
4. **Events are deleted** at midnight after the last candidate day (event time zone), with their participants and availability. Their links then show "Link not found". Clean-up runs whenever an event is created or a host/participant page loads.

## Email setup

Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env` and restart. The account needs 2-Step Verification. Create the app password (16 letters) at https://myaccount.google.com/apppasswords. Without these, events are still created, but no emails go out: the dashboard says invites weren't sent, and the reminder and calendar buttons explain what's missing.

- Emails come from that Gmail address, shown as "*Host name* via schedule-meet", with `Reply-To` set to the host. Corporate mail filters may mark them as external or spam.
- Each email is sent separately. Invites and reminders have a QR code of the participant's link attached.
- If some sends fail, the rest still go out. Each participant's invite is recorded, so retrying emails only the people who missed out.
- Gmail allows about 500 recipients a day.
- Daily reminders: on a normal server (Docker, `next start`), a timer inside the server (`instrumentation.ts`) checks every minute, so the server must be running at 9am. If it's down then, the reminder goes out when it's back that day. On Vercel, Vercel Cron does the check instead (see [Deploying](#deploying)). Each event gets at most one reminder per day: a manual one sent after 9am counts too. A failed daily send isn't retried until the next day.
- Reminder links are built from `BASE_URL`, because there's no request to take the host from. On Vercel it falls back to the project's production domain. Elsewhere, **set `BASE_URL` in production**, or the links point at `http://localhost:3000`.

## Running locally

Only Docker is needed. Node runs in a container.

```bash
docker compose up        # Postgres + Next.js dev server (installs deps, applies migrations)
open http://localhost:3000
```

Other commands (run inside the app container):

```bash
docker compose run --rm app npm test                                  # unit tests (Vitest)
docker compose run --rm app npx tsc --noEmit                          # typecheck
docker compose run --rm app npx prisma migrate dev --name <change>    # after editing prisma/schema.prisma
```

If you have Node 22 locally instead: `cp .env.example .env && docker compose up -d db && npm install && npx prisma migrate deploy && npm run dev`.

## Deploying

Participant links must be reachable by participants, so deploy for real use (e.g. Vercel + Neon/Supabase Postgres). Set `DATABASE_URL`, `BASE_URL` (used in daily reminder links), and the Gmail settings, and run `npx prisma migrate deploy` once.

**On Vercel**, daily reminders run as a Vercel Cron Job that calls `/api/cron/reminders` (configured in `vercel.json`):

- Set `CRON_SECRET` to a random string. Vercel sends it with each cron call, and the endpoint rejects calls without it.
- The schedule is `0 1 * * *`: once a day at 01:00 UTC, which is 9am in Singapore. Vercel's Hobby plan allows only daily cron jobs and may run them any time within that hour, so reminders arrive between 9:00 and 9:59 Singapore time. Hosts in other time zones get theirs at the next run after their 9am.
- On the Pro plan, change the schedule to `0 * * * *` (hourly) so every time zone gets its reminder in its own 9am hour.
- Cron jobs only run on the production deployment.

**On a long-running server** (Docker, `next start`, Railway, Fly), the in-server timer handles reminders and `vercel.json` is ignored.

## Code map

| Path | What |
|---|---|
| `app/actions.ts` | Server actions: create event (and email invites), save availability, send reminders, choose slot, send the calendar invitation |
| `app/host/[adminToken]/page.tsx` | Host dashboard |
| `app/e/[token]/page.tsx` | Participant page |
| `lib/slots.ts` | Time-zone-aware grid and slot ranking |
| `lib/emails.ts` | Invite, reminder, and calendar invitation email text |
| `lib/mailer.ts` | Sends email via Gmail SMTP |
| `lib/calendar.ts` | Builds the calendar invitation (`.ics`) |
| `lib/reminders.ts` | Daily 9am reminders, triggered by `instrumentation.ts` (in-server timer) or `app/api/cron/reminders` (Vercel Cron) |
| `lib/participants.ts` | Parses pasted participant lists |
