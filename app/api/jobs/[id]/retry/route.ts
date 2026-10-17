import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { retryJob } from "@/lib/jobs";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/jobs/[id]/retry">) {
  const { id } = await ctx.params;
  return handle(async () => {
    await retryJob(id);
    return { ok: true };
  });
}
