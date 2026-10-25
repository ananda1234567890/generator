"use client";

import { useState } from "react";
import { JobList } from "@/components/JobList";
import { useStore } from "@/lib/client/store";

const FILTERS = ["all", "video", "image", "headshot", "failed"] as const;

export default function SessionPage() {
  const { jobs } = useStore();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const shown = jobs.filter((j) => (filter === "all" ? true : filter === "failed" ? j.status === "failed" : j.kind === filter));
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">Everything from this session. It disappears when you close the tab, so download what you need.</p>
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
      <JobList jobs={shown} />
    </div>
  );
}
