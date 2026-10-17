import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { createJobs, type GenerateInput } from "@/lib/jobs";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerateInput;
  return handle(() => createJobs(body));
}
