# Generator

A private dashboard for generating AI video, images and headshots with your own API keys, with a history nobody else can delete.

- **Generate** — pick a model (Kling, Seedance, Veo, Nano Banana…), count, length, quality, aspect ratio, audio. Queue up to 10 at once.
- **Headshots** — upload a headshot, or generate one from 1–5 photos. Name it, then type `@name` in any prompt to use it.
- **Library** — every result is copied into your own storage the moment it finishes. Failed jobs have a Retry button.
- **Settings** — shows which API keys are connected.

Providers: ElevenLabs (Seedance 2.0 / 2.0 Fast / 2.5, Veo 3.1, images, headshots) and Leonardo (Kling 3.0 / 2.6 / 2.5 Turbo, Seedance 2.0 / 2.5).

## How `@name` tags work

| Model supports | What happens |
| --- | --- |
| Reference images (Kling 3.0, Seedance) | Tagged headshots are sent as references |
| No references (Kling 2.5 / 2.6, Veo) | The first tagged headshot becomes the start frame |
| You also set a start/end image | Your image wins and tags are ignored (you get a warning) |

No tag, no headshot sent.

## Setup

### 1. Supabase (database + file storage, free tier is fine)
1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → paste [supabase/schema.sql](supabase/schema.sql) → Run.
3. Project Settings → API: copy the **Project URL**, **anon key** and **service_role key**.

### 2. Environment variables
Copy `.env.example` to `.env.local` and fill it in (on Vercel: Project → Settings → Environment Variables).

| Variable | What |
| --- | --- |
| `APP_PASSWORD` | the password you type to open the dashboard |
| `SESSION_SECRET` | any long random string (32+ chars) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
| `ELEVENLABS_API_KEY` | needs a Pro plan or above, with the **Image & Video** permission. Seedance must be enabled for API use on the account. |
| `LEONARDO_API_KEY` | from Leonardo's API settings |

The service-role key and API keys are only ever read on the server.

### 3. Run on your Mac
```bash
npm install
npm run dev     # http://localhost:3000
```

### 4. Deploy on Vercel
Import this GitHub repo at [vercel.com/new](https://vercel.com/new), add the same environment variables, deploy. Every push to `main` redeploys.

## How it works

Generating creates job rows in the database. While the dashboard is open it calls `/api/jobs/tick` every 10 seconds, which submits queued jobs to the provider, checks running ones, and copies finished files into Supabase storage. A failed job never blocks the rest. If you close the tab, jobs keep running at the provider and are collected the next time you open the dashboard (ElevenLabs download links last about an hour, so reopen within that window for best results).

## Known limits

- Single shared password, no per-user accounts.
- No cost estimate: providers bill in their own credits and don't expose prices in the API.
- Supabase's free tier limits each file to 50 MB.
- Leonardo's docs don't show full response shapes or all pixel sizes for Seedance. The code searches responses defensively and uses the same sizes as Kling. If a Leonardo model rejects a size, adjust `ASPECT_DIMS` in [lib/models.ts](lib/models.ts).
- Models and limits live in [lib/models.ts](lib/models.ts). Update it when providers add models.

## Tests

The request-building and tag logic was checked against mocked ElevenLabs and Leonardo responses; live generation depends on your keys and plan.
