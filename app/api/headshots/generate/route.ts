import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { createHeadshotJobs } from "@/lib/jobs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name: string; prompt: string; sources: string[]; count: number };
  return handle(() => createHeadshotJobs(body));
}
