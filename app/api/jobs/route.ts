import { handle } from "@/lib/api";
import { listJobs } from "@/lib/jobs";

export async function GET() {
  return handle(async () => ({ jobs: await listJobs() }));
}
