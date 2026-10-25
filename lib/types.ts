export type JobKind = "video" | "image" | "headshot";
export type JobStatus = "queued" | "submitting" | "running" | "done" | "failed";

// An image the browser sends to the server: small uploads travel as data URLs,
// results that live at a provider link travel as URLs.
export type ImageRef = { dataUrl: string } | { url: string };

// Input to the provider adapters. Image fields are keys the server maps to
// bytes (see app/api/submit), not storage paths.
export interface JobParams {
  rawPrompt: string;
  tags: string[];
  resolution: string;
  aspectRatio: string;
  duration?: number;
  audio?: boolean;
  startFrame?: string;
  endFrame?: string;
  refs: string[];
}

export interface SubmitBody {
  kind: JobKind;
  modelId: string;
  prompt: string;
  resolution: string;
  aspectRatio: string;
  duration?: number;
  audio?: boolean;
  startFrame?: ImageRef;
  endFrame?: ImageRef;
  tagged: { name: string; image: ImageRef }[]; // headshots tagged with @name in the prompt
  sources?: ImageRef[]; // headshot jobs: the photos of the person
}

export interface SubmitResult {
  providerJobId: string;
  prompt: string; // prompt with @ removed
  warnings: string[];
}

export interface PollResponse {
  state: "running" | "done" | "failed";
  url?: string; // provider link to the result (expires, about an hour for ElevenLabs)
  dataUrl?: string; // small images come back inline so they never expire
  mime?: string;
  error?: string;
}
