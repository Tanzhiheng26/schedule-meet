export type ParsedParticipant = { name: string; email: string };

const EMAIL = /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/;

export const isEmail = (s: string) => EMAIL.test(s);

/**
 * Accepts one entry per line or semicolon-separated (as Outlook copies them), e.g.
 *   Tan, Zhi Heng <zh@corp.com>; alice@corp.com, bob@corp.com
 * Entries without "<...>" may also be separated by commas or spaces.
 */
export function parseParticipants(text: string): { participants: ParsedParticipant[]; invalid: string[] } {
  const participants: ParsedParticipant[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  const add = (rawName: string, rawEmail: string, original: string) => {
    const email = rawEmail.trim().toLowerCase();
    if (!isEmail(email)) return void invalid.push(original.trim());
    if (seen.has(email)) return;
    seen.add(email);
    const name = rawName.trim().replace(/^["']|["']$/g, "").trim() || email.split("@")[0];
    participants.push({ name, email });
  };

  for (const chunk of text.split(/[\n;]+/)) {
    const entry = chunk.trim();
    if (!entry) continue;
    const named = /^(.*?)\s*<([^<>]+)>$/.exec(entry);
    if (named) add(named[1], named[2], entry);
    else for (const part of entry.split(/[\s,]+/).filter(Boolean)) add("", part, part);
  }
  return { participants, invalid };
}
