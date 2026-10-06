// Runs once when the Next.js server starts. On Vercel, servers don't stay up, so Vercel Cron
// calls /api/cron/reminders instead (see vercel.json).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { startReminderScheduler } = await import("./lib/reminders");
    startReminderScheduler();
  }
}
