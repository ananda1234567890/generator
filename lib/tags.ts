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

const NAME_CHAR = /[A-Za-z0-9_-]/;

export interface TagAt {
  start: number; // index of the "@"
  end: number; // end of the whole tag word (exclusive)
  query: string; // text between "@" and the caret
}

// Is the caret inside or right after an "@tag"? (Not for emails like a@b.)
export function findTagAt(value: string, caret: number): TagAt | null {
  let s = caret;
  while (s > 0 && NAME_CHAR.test(value[s - 1])) s--;
  if (s === 0 || value[s - 1] !== "@") return null;
  const at = s - 1;
  if (at > 0 && NAME_CHAR.test(value[at - 1])) return null;
  let e = caret;
  while (e < value.length && NAME_CHAR.test(value[e])) e++;
  return { start: at, end: e, query: value.slice(at + 1, caret) };
}

// Alphabetical. Names that start with the query come first, then names that merely contain it.
export function filterByName<T extends { name: string }>(list: T[], query: string): T[] {
  const q = query.toLowerCase();
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const all = [...list].sort(byName);
  if (!q) return all;
  const starts = all.filter((h) => h.name.toLowerCase().startsWith(q));
  const contains = all.filter((h) => !h.name.toLowerCase().startsWith(q) && h.name.toLowerCase().includes(q));
  return [...starts, ...contains];
}

// "@words" in the prompt that match no known headshot.
export function unknownTags(prompt: string, known: string[]): string[] {
  const lower = new Set(known.map((n) => n.toLowerCase()));
  const out: string[] = [];
  for (const m of prompt.matchAll(/(^|[^A-Za-z0-9_-])@([A-Za-z0-9_-]+)/g)) {
    if (!lower.has(m[2].toLowerCase()) && !out.includes(m[2])) out.push(m[2]);
  }
  return out;
}

// Text to put after a picked tag so typing can continue.
export function spaceAfterTag(after: string) {
  return after.length === 0 ? " " : /^[\s.,;:!?)]/.test(after) ? "" : " ";
}
