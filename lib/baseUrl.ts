import { headers } from "next/headers";

/**
 * The base URL for links made outside a request (e.g. scheduled reminders): BASE_URL, else the
 * Vercel production domain, else localhost.
 */
export function configuredBaseUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.BASE_URL ?? (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/$/, "");
}

export async function getBaseUrl(): Promise<string> {
  if (process.env.BASE_URL) return configuredBaseUrl();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
