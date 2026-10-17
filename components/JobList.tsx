"use client";

import { useState } from "react";
import { getModel } from "@/lib/models";
import type { JobView } from "@/lib/types";

const LABEL: Record<string, string> = {
  queued: "Queued",
  submitting: "Starting…",
  running: "Generating…",
  saving: "Saving…",
  done: "Done",
  failed: "Failed",
};

function JobCard({ job, onRetry }: { job: JobView; onRetry: () => void }) {
  const model = getModel(job.model);
  const active = !["done", "failed"].includes(job.status);
  const p = job.params;
  const meta = [p.resolution, p.aspectRatio, p.duration ? `${p.duration}s` : null].filter(Boolean).join(" · ");
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex aspect-video items-center justify-center bg-black">
        {job.status === "done" && job.url ? (
          job.kind === "video" ? (
            <video src={job.url} controls preload="metadata" className="h-full w-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.url} alt={job.prompt} className="h-full w-full object-contain" />
          )
        ) : job.status === "failed" ? (
          <p className="px-4 text-center text-sm text-red-400">{job.error ?? "Failed"}</p>
        ) : (
          <div className="flex flex-col items-center gap-2 text-sm text-muted">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-transparent" />
            {LABEL[job.status]}
          </div>
        )}
      </div>
      <div className="space-y-1 p-3 text-sm">
        <p className="line-clamp-2">{job.prompt}</p>
        <p className="text-xs text-muted">
          {model?.label ?? job.model}
          {meta && ` · ${meta}`}
        </p>
        {job.warning && <p className="text-xs text-amber-400">{job.warning}</p>}
        <div className="flex items-center gap-3 pt-1 text-xs">
          <span className={job.status === "failed" ? "text-red-400" : active ? "text-amber-300" : "text-emerald-400"}>
            {LABEL[job.status]}
          </span>
          {job.status === "failed" && (
            <button onClick={onRetry} className="text-accent hover:underline">
              Retry
            </button>
          )}
          {job.status === "done" && job.url && (
            <a href={job.url} download target="_blank" rel="noreferrer" className="text-accent hover:underline">
              Download
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function JobList({ jobs, onChanged }: { jobs: JobView[]; onChanged: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  async function retry(id: string) {
    const res = await fetch(`/api/jobs/${id}/retry`, { method: "POST" });
    if (!res.ok) setErr((await res.json()).error ?? "Retry failed");
    else onChanged();
  }
  if (!jobs.length) return <p className="text-sm text-muted">Nothing here yet.</p>;
  return (
    <>
      {err && <p className="mb-2 text-sm text-red-400">{err}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} onRetry={() => retry(j.id)} />
        ))}
      </div>
    </>
  );
}
