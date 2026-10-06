# schedule-meet

A when2meet-style scheduler. The host creates an event and participants mark their availability on a grid. The app tracks who has responded and finds the best time.

**Invites** are emailed automatically from a Gmail account when the event is created (see [Email setup](#email-setup)). **Reminders** can be sent the same way with one click. The **meeting invitation** goes out from the **host's own Outlook**: the app writes a ready-to-paste prompt, the host pastes it into **ChatGPT Enterprise**, and ChatGPT uses its Outlook Calendar app to create the meeting. Reminders also have a ChatGPT prompt as a fallback.

## How it works

1. **Create an event** (`/`): title, the specific days to consider (pick any days on a calendar), daily hours, meeting length, required and optional participant emails (paste them straight from Outlook). The grid uses 30-minute slots, and times use the host's browser time zone.
2. **Host dashboard** (`/host/<secret>`, bookmark it):
   - **Invites**: each participant was emailed their personal link (with a QR code) when the event was created. If any didn't go out, the dashboard lists them with a *Send invites* button that retries only those people.
   - **Responses**: ✅/⏳ per participant, marked Required or Optional (you can switch each one). The page refreshes every 30s.
   - **Send a reminder**: appears while any invited participant hasn't responded. Send it whenever you like, with *Send reminders now* or the ChatGPT prompt. It goes only to non-responders.
   - **Best times**: meeting slots ranked by how many required participants are free, then how many people overall. You can pick one once all required participants have responded. Optional participants never block scheduling.
   - **Book the meeting**: appears once all required participants have responded, with the best time preselected. It gives a ChatGPT prompt to create the Outlook meeting (listing required and optional attendees separately).
3. **Participants** (`/e/<token>`): click or drag to mark free times, then save. They can come back and edit.
4. **Events are deleted** at midnight after the last candidate day (event time zone), with their participants and availability. Their links then show "Link not found". Clean-up runs whenever an event is created or a host/participant page loads.

> **ChatGPT prerequisite:** your ChatGPT workspace admin must enable **write actions** for the Outlook Calendar app (and Outlook Email, if you use the reminder prompt) (they're off by default). ChatGPT may also ask you to approve each send.

## Email setup

Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env` and restart. The account needs 2-Step Verification. Create the app password (16 letters) at https://myaccount.google.com/apppasswords. Without these, events are still created, but the dashboard shows that no invites went out.

- Emails come from that Gmail address, shown as "*Host name* via schedule-meet", with `Reply-To` set to the host. Corporate mail filters may mark them as external or spam.
- Each email is sent separately with a QR code of the participant's link attached.
- If some sends fail, the rest still go out. Each participant's invite is recorded, so retrying emails only the people who missed out.
- Gmail allows about 500 recipients a day.

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

Participant links must be reachable by participants, so deploy for real use (e.g. Vercel + Neon/Supabase Postgres). Set `DATABASE_URL`, and run `npx prisma migrate deploy` once. Links use the request's host. Set `BASE_URL` to override.

## Code map

| Path | What |
|---|---|
| `app/actions.ts` | Server actions: create event (and email invites), save availability, send/mark reminders, choose slot |
| `app/host/[adminToken]/page.tsx` | Host dashboard |
| `app/e/[token]/page.tsx` | Participant page |
| `lib/slots.ts` | Time-zone-aware grid and slot ranking |
| `lib/prompts.ts` | Invite/reminder email text and ChatGPT prompts |
| `lib/mailer.ts` | Sends email via Gmail SMTP |
| `lib/participants.ts` | Parses pasted participant lists |
