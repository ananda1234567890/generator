"use client";

import { GenerateForm } from "@/components/GenerateForm";
import { JobList } from "@/components/JobList";
import { useJobs } from "@/components/useJobs";

export default function GeneratePage() {
  const { jobs, error, refresh } = useJobs();
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <GenerateForm onSubmitted={refresh} />
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Recent</h2>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {jobs ? <JobList jobs={jobs.filter((j) => j.kind !== "headshot").slice(0, 18)} onChanged={refresh} /> : <p className="text-sm text-muted">Loading…</p>}
      </section>
    </div>
  );
}
