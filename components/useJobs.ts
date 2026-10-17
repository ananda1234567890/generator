"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { JobView } from "@/lib/types";

const ACTIVE = ["queued", "submitting", "running", "saving"];

// Keeps the job list fresh. While anything is active it calls /api/jobs/tick,
// which also advances the queue; otherwise it just re-reads the list slowly.
export function useJobs() {
  const [jobs, setJobs] = useState<JobView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const jobsRef = useRef<JobView[] | null>(null);
  const busy = useRef(false);
  const router = useRouter();

  const refresh = useCallback(async (advance: boolean) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch(advance ? "/api/jobs/tick" : "/api/jobs", { method: advance ? "POST" : "GET" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Request failed");
      jobsRef.current = body.jobs;
      setJobs(body.jobs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
    }
  }, [router]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      const active = jobsRef.current?.some((j) => ACTIVE.includes(j.status)) ?? true;
      await refresh(active);
      if (!stop) timer = setTimeout(loop, active ? 10_000 : 30_000);
    };
    loop();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [refresh]);

  return { jobs, error, refresh: () => refresh(true) };
}
