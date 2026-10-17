"use client";

import { useState } from "react";
import { JobList } from "@/components/JobList";
import { useJobs } from "@/components/useJobs";

const FILTERS = ["all", "video", "image", "headshot", "failed"] as const;

export default function LibraryPage() {
  const { jobs, error, refresh } = useJobs();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const shown = (jobs ?? []).filter((j) => (filter === "all" ? true : filter === "failed" ? j.status === "failed" : j.kind === filter));
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm capitalize ${filter === f ? "bg-accent" : "border border-line text-muted"}`}
          >
            {f}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {jobs ? <JobList jobs={shown} onChanged={refresh} /> : <p className="text-sm text-muted">Loading…</p>}
    </div>
  );
}
