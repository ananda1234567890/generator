"use client";

import { GenerateForm } from "@/components/GenerateForm";
import { JobList } from "@/components/JobList";
import { useStore } from "@/lib/client/store";

export default function GeneratePage() {
  const { jobs } = useStore();
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <GenerateForm />
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">This session</h2>
        <p className="text-xs text-muted">Results live in this tab only. Download what you want to keep before closing it.</p>
        <JobList jobs={jobs.filter((j) => j.kind !== "headshot")} />
      </section>
    </div>
  );
}
