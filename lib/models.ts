// Model catalog. Shared by the UI (to decide which options to show) and the
// server (to validate requests and build provider payloads).
// Values come from the ElevenLabs and Leonardo docs; adjust here when a
// provider adds or changes a model.

export type Provider = "elevenlabs" | "leonardo";
export type Kind = "video" | "image";

export interface ModelDef {
  id: string; // our id, "<provider>:<providerModel>"
  label: string;
  provider: Provider;
  providerModel: string;
  kind: Kind;
  durations?: number[];
  resolutions: string[];
  defaultResolution: string;
  aspectRatios: string[];
  defaultAspect: string;
  audio?: boolean; // video: has an audio toggle
  startFrame?: "optional" | "required";
  endFrame?: boolean;
  maxRefs: number; // max reference images (tagged headshots) when no start frame
  note?: string;
}

const range = (a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const MODELS: ModelDef[] = [
  // ---- Video: Leonardo ----
  {
    id: "leonardo:kling-3.0",
    label: "Kling 3.0",
    provider: "leonardo",
    providerModel: "kling-3.0",
    kind: "video",
    durations: range(3, 15),
    resolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    aspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspect: "16:9",
    audio: true,
    startFrame: "optional",
    endFrame: true,
    maxRefs: 7,
  },
  {
    id: "leonardo:kling-2.6",
    label: "Kling 2.6",
    provider: "leonardo",
    providerModel: "kling-2.6",
    kind: "video",
    durations: [5, 10],
    resolutions: ["1080p"],
    defaultResolution: "1080p",
    aspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspect: "16:9",
    startFrame: "required",
    maxRefs: 0,
    note: "Needs a start image (or a tagged headshot).",
  },
  {
    id: "leonardo:Kling2_5",
    label: "Kling 2.5 Turbo",
    provider: "leonardo",
    providerModel: "Kling2_5",
    kind: "video",
    durations: [5, 10],
    resolutions: ["1080p"],
    defaultResolution: "1080p",
    aspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspect: "16:9",
    startFrame: "required",
    endFrame: true,
    maxRefs: 0,
    note: "Needs a start image (or a tagged headshot).",
  },
  {
    id: "leonardo:seedance-2.0",
    label: "Seedance 2.0 (Leonardo)",
    provider: "leonardo",
    providerModel: "seedance-2.0",
    kind: "video",
    durations: range(4, 15),
    resolutions: ["480p", "720p", "1080p"],
    defaultResolution: "720p",
    aspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspect: "16:9",
    audio: true,
    startFrame: "optional",
    endFrame: true,
    maxRefs: 4,
  },
  {
    id: "leonardo:bytedance/seedance-2.5",
    label: "Seedance 2.5 (Leonardo)",
    provider: "leonardo",
    providerModel: "bytedance/seedance-2.5",
    kind: "video",
    durations: range(4, 30),
    resolutions: ["480p", "720p"],
    defaultResolution: "720p",
    aspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspect: "16:9",
    audio: true,
    startFrame: "optional",
    endFrame: true,
    maxRefs: 30,
  },
  // ---- Video: ElevenLabs ----
  {
    id: "elevenlabs:bytedance-seedance-v2.5",
    label: "Seedance 2.5 (ElevenLabs)",
    provider: "elevenlabs",
    providerModel: "bytedance-seedance-v2.5",
    kind: "video",
    durations: range(4, 30),
    resolutions: ["480p", "720p"],
    defaultResolution: "720p",
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    defaultAspect: "16:9",
    audio: true,
    startFrame: "optional",
    endFrame: true,
    maxRefs: 30,
    note: "ByteDance models must be enabled for API use on your ElevenLabs account.",
  },
  {
    id: "elevenlabs:bytedance-seedance-v2",
    label: "Seedance 2.0 (ElevenLabs)",
    provider: "elevenlabs",
    providerModel: "bytedance-seedance-v2",
    kind: "video",
    durations: range(4, 15),
    resolutions: ["480p", "720p", "1080p"],
    defaultResolution: "720p",
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    defaultAspect: "16:9",
    audio: true,
    startFrame: "optional",
    endFrame: true,
    maxRefs: 9,
    note: "ByteDance models must be enabled for API use on your ElevenLabs account.",
  },
  {
    id: "elevenlabs:bytedance-seedance-v2-fast",
    label: "Seedance 2.0 Fast (ElevenLabs)",
    provider: "elevenlabs",
    providerModel: "bytedance-seedance-v2-fast",
    kind: "video",
    durations: range(4, 15),
    resolutions: ["480p", "720p"],
    defaultResolution: "720p",
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    defaultAspect: "16:9",
    audio: true,
    startFrame: "optional",
    endFrame: true,
    maxRefs: 9,
    note: "ByteDance models must be enabled for API use on your ElevenLabs account.",
  },
  {
    id: "elevenlabs:veo-3.1-generate-001",
    label: "Veo 3.1 (ElevenLabs)",
    provider: "elevenlabs",
    providerModel: "veo-3.1-generate-001",
    kind: "video",
    durations: [4, 6, 8],
    resolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    aspectRatios: ["16:9", "9:16"],
    defaultAspect: "16:9",
    audio: true,
    startFrame: "optional",
    endFrame: true,
    maxRefs: 0,
  },
  {
    id: "elevenlabs:veo-3.1-fast-generate-001",
    label: "Veo 3.1 Fast (ElevenLabs)",
    provider: "elevenlabs",
    providerModel: "veo-3.1-fast-generate-001",
    kind: "video",
    durations: [4, 6, 8],
    resolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    aspectRatios: ["16:9", "9:16"],
    defaultAspect: "16:9",
    audio: true,
    startFrame: "optional",
    endFrame: true,
    maxRefs: 0,
  },
  // ---- Image: ElevenLabs ----
  {
    id: "elevenlabs:gemini-3-pro-image",
    label: "Nano Banana Pro",
    provider: "elevenlabs",
    providerModel: "gemini-3-pro-image",
    kind: "image",
    resolutions: ["1K", "2K", "4K"],
    defaultResolution: "2K",
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"],
    defaultAspect: "16:9",
    maxRefs: 10,
    note: "Best at keeping the same person consistent.",
  },
  {
    id: "elevenlabs:gpt-image-2",
    label: "GPT Image 2",
    provider: "elevenlabs",
    providerModel: "gpt-image-2",
    kind: "image",
    resolutions: ["low", "medium", "high"],
    defaultResolution: "high",
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"],
    defaultAspect: "16:9",
    maxRefs: 10,
  },
  {
    id: "elevenlabs:gemini-2.5-flash-image",
    label: "Nano Banana",
    provider: "elevenlabs",
    providerModel: "gemini-2.5-flash-image",
    kind: "image",
    resolutions: ["default"],
    defaultResolution: "default",
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"],
    defaultAspect: "16:9",
    maxRefs: 10,
  },
];

export const HEADSHOT_MODEL_ID = "elevenlabs:gemini-3-pro-image";

export const getModel = (id: string) => MODELS.find((m) => m.id === id);

export const ASPECT_DIMS: Record<string, Record<string, [number, number]>> = {
  // [width, height] used by Leonardo, which takes pixels instead of ratios.
  "480p": { "16:9": [848, 480], "9:16": [480, 848], "1:1": [640, 640] },
  "720p": { "16:9": [1280, 720], "9:16": [720, 1280], "1:1": [960, 960] },
  "1080p": { "16:9": [1920, 1080], "9:16": [1080, 1920], "1:1": [1440, 1440] },
};
