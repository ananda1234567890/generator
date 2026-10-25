# Generator

A private dashboard for generating AI video, images and headshots with your own API keys. **Nothing is stored.** Results live in your browser tab and disappear when you close it.

- **Generate** — pick a model (Kling, Seedance, Veo, Nano Banana…), count, length, quality, aspect ratio, audio. Queue up to 10 at once.
- **Headshots** — upload a headshot, or generate one from 1–5 photos. Name it, then type `@name` in any prompt to use it.
- **Session** — everything from this tab, with filters and Retry for failed jobs.
- **Settings** — shows which API keys are connected.

Providers: ElevenLabs (Seedance 2.0 / 2.0 Fast / 2.5, Veo 3.1, images, headshots) and Leonardo (Kling 3.0 / 2.6 / 2.5 Turbo, Seedance 2.0 / 2.5).

## What "nothing is stored" means

- The server keeps no database and no files. API keys live in environment variables on the server only.
- Jobs, headshots and results are held in the browser tab (and mirrored to `sessionStorage`, so a refresh keeps them). Closing the tab wipes them, and the browser warns you first.
- Finished videos are links to the provider's storage. ElevenLabs links expire after about an hour, so download what you want. Your generations also stay in your ElevenLabs / Leonardo history.
- Headshots are small images kept in the tab, so re-add them in a new session.

## How `@name` tags work

| Model supports | What happens |
| --- | --- |
| Reference images (Kling 3.0, Seedance) | Tagged headshots are sent as references |
| No references (Kling 2.5 / 2.6, Veo) | The first tagged headshot becomes the start frame |
| You also set a start/end image | Your image wins and tags are ignored (you get a warning) |

No tag, no headshot sent.

## Setup

### Environment variables
Copy `.env.example` to `.env.local` (on Vercel: Project → Settings → Environment Variables).

| Variable | What |
| --- | --- |
| `APP_PASSWORD` | the password you type to open the dashboard |
| `SESSION_SECRET` | a long random string. Make one with `openssl rand -hex 32` |
| `ELEVENLABS_API_KEY` | needs a Pro plan or above, with the **Image & Video** permission. Seedance must be enabled for API use on the account. |
| `LEONARDO_API_KEY` | from Leonardo's API settings |

### Run on your Mac
```bash
npm install
npm run dev     # http://localhost:3000
```

### Deploy on Vercel
Import this GitHub repo at [vercel.com/new](https://vercel.com/new), add the four variables above, deploy. Every push to `main` redeploys. After adding or changing variables, redeploy.

## How it works

The browser keeps a queue. It sends each job to `/api/submit` (which starts it at the provider), then checks `/api/poll` every few seconds until it is done. Up to 3 jobs are started at a time, and a failed job never blocks the rest. Photos are shrunk in the browser before sending, because Vercel rejects requests over about 4.5 MB. The tab must stay open while jobs run.

## Known limits

- Single shared password, no per-user accounts.
- No cost estimate: providers bill in their own credits.
- Keep the tab open until jobs finish; closing it loses track of them (they still appear in the provider's own history).
- Leonardo's docs don't show full response shapes or all pixel sizes for Seedance. The code searches responses defensively and uses the same sizes as Kling. If a Leonardo model rejects a size, adjust `ASPECT_DIMS` in [lib/models.ts](lib/models.ts).
- Models and limits live in [lib/models.ts](lib/models.ts). Update it when providers add models.

## Tests

Request building, tag/headshot rules and the in-tab queue were checked with mocked ElevenLabs and Leonardo responses and a real browser. Live generation depends on your keys and plan.
