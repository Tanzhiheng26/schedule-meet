# schedule-meet

A when2meet-style scheduler. The host creates an event and participants mark their availability on a grid. The app tracks who has responded and finds the best time.

The app never sends email itself. Invites, reminders, and the meeting invitation go out from the **host's own Outlook**: the app writes a ready-to-paste prompt, the host pastes it into **ChatGPT Enterprise**, and ChatGPT uses its Outlook Email / Outlook Calendar apps to send it.

## How it works

1. **Create an event** (`/`): title, the specific days to consider (pick any days on a calendar), daily hours, meeting length, required and optional participant emails (paste them straight from Outlook). The grid uses 30-minute slots, and times use the host's browser time zone.
2. **Host dashboard** (`/host/<secret>`, bookmark it):
   - **Step 1 · Send the invites**: copy the prompt into ChatGPT, then click *I've sent the invites*.
   - **Responses**: ✅/⏳ per participant, marked Required or Optional (you can switch each one). The page refreshes every 30s.
   - **Send a reminder**: appears after you mark the invites as sent, and stays while anyone hasn't responded. Send it whenever you like. The prompt includes only non-responders.
   - **Best times**: meeting slots ranked by how many required participants are free, then how many people overall. You can pick one once all required participants have responded. Optional participants never block scheduling.
   - **Step 2 · Book the meeting**: appears once all required participants have responded, with the best time preselected. It gives a ChatGPT prompt to create the Outlook meeting (listing required and optional attendees separately).
3. **Participants** (`/e/<token>`): click or drag to mark free times, then save. They can come back and edit.

> **ChatGPT prerequisite:** your ChatGPT workspace admin must enable **write actions** for the Outlook Email and Outlook Calendar apps (they're off by default). ChatGPT may also ask you to approve each send.

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
| `app/actions.ts` | Server actions: create event, save availability, mark invites/reminders sent, choose slot |
| `app/host/[adminToken]/page.tsx` | Host dashboard |
| `app/e/[token]/page.tsx` | Participant page |
| `lib/slots.ts` | Time-zone-aware grid and slot ranking |
| `lib/prompts.ts` | ChatGPT prompt text |
| `lib/participants.ts` | Parses pasted participant lists |
