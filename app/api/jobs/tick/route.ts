import { handle } from "@/lib/api";
import { listJobs, tick } from "@/lib/jobs";

export const maxDuration = 60;

// The dashboard calls this every few seconds while jobs are active. It submits
// queued jobs, checks running ones, saves finished files, and returns the list.
export async function POST() {
  return handle(async () => {
    await tick();
    return { jobs: await listJobs() };
  });
}
