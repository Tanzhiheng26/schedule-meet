import nodemailer from "nodemailer";
import QRCode from "qrcode";
import type { Email } from "./prompts";

/** Automatic sending is on only when a Gmail account and app password are configured. */
export const emailConfigured = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

export type SendResult = { sent: string[]; failed: string[] };

/**
 * Sends each email separately from the configured Gmail account, with the host as the display name and
 * Reply-To so replies reach them. Each email gets a QR code of its availability link. One failure doesn't
 * stop the rest.
 */
export async function sendEmails(host: { name: string; email: string }, emails: Email[]): Promise<SendResult> {
  const user = process.env.GMAIL_USER!;
  const transport = nodemailer.createTransport({
    service: "gmail",
    pool: true, // one SMTP connection for the whole batch
    auth: { user, pass: process.env.GMAIL_APP_PASSWORD },
  });
  const result: SendResult = { sent: [], failed: [] };
  for (const e of emails) {
    try {
      await transport.sendMail({
        from: { name: `${host.name} via schedule-meet`, address: user },
        replyTo: { name: host.name, address: host.email },
        to: e.to,
        subject: e.subject,
        text: e.body,
        attachments: [{ filename: "availability-qr.png", content: await QRCode.toBuffer(e.link) }],
      });
      result.sent.push(e.to);
    } catch (err) {
      console.error(`Failed to email ${e.to}:`, err);
      result.failed.push(e.to);
    }
  }
  transport.close();
  return result;
}
