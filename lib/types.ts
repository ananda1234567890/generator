export type JobKind = "video" | "image" | "headshot";
export type JobStatus = "queued" | "submitting" | "running" | "saving" | "done" | "failed";

export interface JobParams {
  rawPrompt: string;
  tags: string[];
  resolution: string;
  aspectRatio: string;
  duration?: number;
  audio?: boolean;
  startFrame?: string; // storage path
  endFrame?: string; // storage path
  refs: string[]; // storage paths of reference images
  headshotName?: string; // headshot jobs: name to save the result under
  saveAttempts?: number;
}

export interface Job {
  id: string;
  batch_id: string | null;
  kind: JobKind;
  model: string; // ModelDef.id
  provider: "elevenlabs" | "leonardo";
  prompt: string;
  params: JobParams;
  status: JobStatus;
  provider_job_id: string | null;
  error: string | null;
  warning: string | null;
  output_path: string | null;
  mime: string | null;
  remote_url: string | null;
  created_at: string;
  updated_at: string;
  polled_at: string | null;
}

export interface JobView extends Job {
  url: string | null; // signed URL for the saved file
}

export interface Headshot {
  id: string;
  name: string;
  storage_path: string;
  source: "upload" | "generated";
  created_at: string;
}

export interface HeadshotView extends Headshot {
  url: string | null;
}
