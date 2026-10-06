import { sendDueReminders } from "@/lib/reminders";

// Called by Vercel Cron (see vercel.json). Elsewhere the in-server timer in instrumentation.ts does this.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await sendDueReminders();
  return Response.json({ ok: true });
}
