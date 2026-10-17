// "@Randy" in a prompt attaches the headshot named Randy.

export const NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;

export interface TagResult {
  prompt: string; // prompt with the "@" removed so it still reads naturally
  names: string[]; // matched headshot names (canonical casing), in order, unique
}

export function parseTags(prompt: string, known: string[]): TagResult {
  const byLower = new Map(known.map((n) => [n.toLowerCase(), n]));
  const names: string[] = [];
  const out = prompt.replace(/@([A-Za-z0-9_-]+)/g, (full, raw: string) => {
    const hit = byLower.get(raw.toLowerCase());
    if (!hit) return full;
    if (!names.includes(hit)) names.push(hit);
    return hit;
  });
  return { prompt: out, names };
}
