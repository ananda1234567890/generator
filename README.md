# Generator

A dashboard for generating AI video, images and headshots with your own API keys. No password, no accounts, no database. The server keeps nothing.

- **Generate** — pick a model (Kling, Seedance, Veo, Nano Banana…), count, length, quality, aspect ratio, audio. Queue up to 10 at once.
- **Headshots** — upload a headshot, or generate one from 1–5 photos. Name it, then type `@name` in any prompt to use it.
- **Session** — everything generated in this tab, with filters and Retry for failed jobs.
- **Settings** — paste, change or remove your API keys whenever you want.

Providers: ElevenLabs (Seedance 2.0 / 2.0 Fast / 2.5, Veo 3.1, images, headshots) and Leonardo (Kling 3.0 / 2.6 / 2.5 Turbo, Seedance 2.0 / 2.5).

## What is kept, and for how long

| | Where | How long |
| --- | --- | --- |
| API keys | This browser (localStorage) | Until you remove them |
| Headshots | This browser (localStorage) | Until you remove them |
| Generated videos / images | This tab's memory | Until you **refresh or close the tab** |

- Each finished video or image is copied into the tab right away, so you can download it whenever you like, even hours later after your computer slept, and even after the provider's link has expired (ElevenLabs links last about an hour). Nothing is copied to the server.
- Refreshing or closing the tab loses generated results. The browser warns you first. They still exist in your ElevenLabs / Leonardo history.
- Keys travel over HTTPS with each request so the server can call the provider for you. The server does not store or log them. Don't save keys in a browser profile other people use.
- Chrome's **Memory Saver** can unload idle tabs, which would lose results. In Chrome: Settings → Performance → "Always keep these sites active" → add this site.
- Browser storage is limited (about 5 MB). Headshots are saved at reduced size, so dozens fit. If it fills up, you are told and can remove some.

## How `@name` tags work

| Model supports | What happens |
| --- | --- |
| Reference images (Kling 3.0, Seedance) | Tagged headshots are sent as references |
| No references (Kling 2.5 / 2.6, Veo) | The first tagged headshot becomes the start frame |
| You also set a start/end image | Your image wins and tags are ignored (you get a warning) |

No tag, no headshot sent.

## Keys you need

- **ElevenLabs** — Pro plan or above, with the **Image & Video** permission. Seedance must be enabled for API use on the account.
- **Leonardo** — create a key in Leonardo's API settings.

Paste them in the **Settings** tab.

## Run on your Mac
```bash
npm install
npm run dev     # http://localhost:3000
```

## Deploy on Vercel
Import this GitHub repo at [vercel.com/new](https://vercel.com/new) and deploy. No environment variables are needed. Every push to `main` redeploys.

## How it works

The browser keeps a queue. It sends each job to `/api/submit` (which starts it at the provider using the key from your browser), then checks `/api/poll` every few seconds until it is done, then pulls the file into the tab through `/api/download`. Up to 3 jobs are started at a time, and a failed job never blocks the rest. Photos are shrunk in the browser before sending, because Vercel rejects requests over about 4.5 MB. The server only fetches files from the providers' own storage hosts.

## Known limits

- The site is open to anyone with the link, but it holds no keys. Nobody can spend your credits without your keys, which are only in your browser.
- Keep the tab open while jobs run; closing it loses track of them (they still appear in the provider's own history).
- Very large videos take time and memory to copy into the tab. Downloading is limited by the server's 60 second window per file.
- No cost estimate: providers bill in their own credits.
- Leonardo's docs don't show full response shapes or all pixel sizes for Seedance. The code searches responses defensively and uses the same sizes as Kling. If a Leonardo model rejects a size, adjust `ASPECT_DIMS` in [lib/models.ts](lib/models.ts).
- Models and limits live in [lib/models.ts](lib/models.ts). Update it when providers add models.

## Tests

Request building, tag/headshot rules, key handling and the in-tab behaviour (keys and headshots surviving a reopen, results surviving link expiry, results cleared on refresh) were checked with mocked ElevenLabs and Leonardo responses and a real browser. Live generation depends on your keys and plan.
