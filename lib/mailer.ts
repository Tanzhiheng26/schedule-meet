import nodemailer from "nodemailer";
import QRCode from "qrcode";
import type { Email } from "./emails";

/** Automatic sending is on only when a Gmail account and app password are configured. */
export const emailConfigured = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

/** `error` explains the first failure, in words the host can act on. */
export type SendResult = { sent: string[]; failed: string[]; error?: string };

function explain(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  if (e.code === "EAUTH") {
    return e.responseCode === 534
      ? "Gmail blocked the sign-in. Sign in to the Gmail account in a browser and approve any security alert, then try again."
      : "Gmail rejected the login. Check GMAIL_USER and GMAIL_APP_PASSWORD (a 16-letter app password).";
  }
  return `Gmail error: ${(e.message ?? String(err)).split("\n")[0]}`;
}

/**
 * Sends each email separately from the configured Gmail account, with the host as the display name and
 * Reply-To so replies reach them. An email with a link gets a QR code of it; one with a calendar
 * invitation gets it as a meeting request. One failure doesn't stop the rest.
 */
export async function sendEmails(host: { name: string; email: string }, emails: Email[]): Promise<SendResult> {
  const user = process.env.GMAIL_USER!;
  const transport = nodemailer.createTransport({
    service: "gmail",
    pool: true, // one SMTP connection for the whole batch
    auth: { user, pass: process.env.GMAIL_APP_PASSWORD },
  });
  const result: SendResult = { sent: [], failed: [] };
  for (const [i, e] of emails.entries()) {
    try {
      await transport.sendMail({
        from: { name: `${host.name} via schedule-meet`, address: user },
        replyTo: { name: host.name, address: host.email },
        to: e.to,
        subject: e.subject,
        text: e.body,
        attachments: e.link ? [{ filename: "availability-qr.png", content: await QRCode.toBuffer(e.link) }] : [],
        icalEvent: e.calendar ? { method: "REQUEST", filename: "invite.ics", content: e.calendar } : undefined,
      });
      result.sent.push(e.to);
    } catch (err) {
      console.error(`Failed to email ${e.to}:`, err);
      result.error ??= explain(err);
      // A rejected login fails every email the same way, so don't retry it for the rest.
      if ((err as { code?: string }).code === "EAUTH") {
        result.failed.push(...emails.slice(i).map((r) => r.to));
        break;
      }
      result.failed.push(e.to);
    }
  }
  transport.close();
  return result;
}
