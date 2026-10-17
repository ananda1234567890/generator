import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "gen_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
}

const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");
const digest = (v: string) => createHash("sha256").update(v).digest();

export function checkPassword(input: string) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD must be set");
  return timingSafeEqual(digest(input), digest(expected));
}

export async function startSession() {
  const exp = String(Date.now() + MAX_AGE * 1000);
  const jar = await cookies();
  jar.set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

// Pure check of a session cookie value (also used by proxy.ts).
export function verifySession(raw: string | undefined) {
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig) return false;
  const good = sign(exp);
  if (sig.length !== good.length) return false;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  return Number(exp) > Date.now();
}

export const SESSION_COOKIE = COOKIE;

export async function isAuthed() {
  return verifySession((await cookies()).get(COOKIE)?.value);
}
