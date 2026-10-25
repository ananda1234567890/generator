import type { ModelDef } from "../models";
import type { Keys } from "../keys";
import type { JobParams } from "../types";

export type FileLoader = (path: string) => Promise<{ bytes: Buffer; mime: string }>;

export interface SubmitArgs {
  model: ModelDef;
  prompt: string;
  params: JobParams;
  load: FileLoader;
  keys: Keys;
}

export type PollResult =
  | { state: "running" }
  | { state: "done"; url: string; mime?: string }
  | { state: "failed"; error: string };
