"use client";

import { dismissJob, retryJob, type ClientJob } from "@/lib/client/store";
import { getModel } from "@/lib/models";

const LABEL: Record<string, string> = {
  queued: "Queued",
  submitting: "Starting…",
  running: "Generating…",
  done: "Done",
  failed: "Failed",
};

function downloadHref(job: ClientJob) {
  const ext = job.kind === "video" ? "mp4" : job.mime?.includes("jpeg") ? "jpg" : "png";
  const name = `${job.kind}-${job.id.slice(0, 8)}.${ext}`;
  if (job.dataUrl) return { href: job.dataUrl, name };
  if (job.url) return { href: `/api/download?url=${encodeURIComponent(job.url)}&name=${name}`, name };
  return null;
}

function JobCard({ job }: { job: ClientJob }) {
  const model = getModel(job.modelId);
  const active = !["done", "failed"].includes(job.status);
  const media = job.dataUrl ?? job.url;
  const dl = downloadHref(job);
  const m = job.meta;
  const meta = [m.resolution, m.aspectRatio, m.duration ? `${m.duration}s` : null].filter(Boolean).join(" · ");
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex aspect-video items-center justify-center bg-black">
        {job.status === "done" && media ? (
          job.kind === "video" ? (
            <video src={media} controls preload="metadata" className="h-full w-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media} alt={job.prompt} className="h-full w-full object-contain" />
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
          {model?.label ?? job.modelId}
          {meta && ` · ${meta}`}
        </p>
        {job.warning && <p className="text-xs text-amber-400">{job.warning}</p>}
        <div className="flex items-center gap-3 pt-1 text-xs">
          <span className={job.status === "failed" ? "text-red-400" : active ? "text-amber-300" : "text-emerald-400"}>
            {LABEL[job.status]}
          </span>
          {job.status === "failed" && job.body && (
            <button onClick={() => retryJob(job.id)} className="text-accent hover:underline">
              Retry
            </button>
          )}
          {job.status === "done" && dl && (
            <a href={dl.href} download={dl.name} className="text-accent hover:underline">
              Download
            </a>
          )}
          {!active && (
            <button onClick={() => dismissJob(job.id)} className="ml-auto text-muted hover:text-foreground">
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function JobList({ jobs }: { jobs: ClientJob[] }) {
  if (!jobs.length) return <p className="text-sm text-muted">Nothing here yet.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((j) => (
        <JobCard key={j.id} job={j} />
      ))}
    </div>
  );
}
