import { NextResponse } from "next/server";
import { isAuthed } from "./auth";
import { UserError } from "./plan";

// Wrap an API handler: require login and turn errors into JSON responses.
export async function handle(fn: () => Promise<unknown>) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof UserError) return NextResponse.json({ error: msg }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
