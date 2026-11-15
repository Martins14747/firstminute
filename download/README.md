# FirstMinute — MVP Web App

**Brand:** FirstMinute
**Files:** `firstminute.html` (frontend, ~140 KB) + `server/` (modular Node.js backend — AI doctor, vision, video, REST API, persistence) + `scripts/generate-videos.js` (offline batch video generator)

## What it is

A mobile-first web app that helps ordinary Nigerians respond to medical emergencies with practical, step-by-step first-aid guidance. It includes an **AI on-site doctor** you can chat with at the scene, **camera vision analysis** that looks at a captured wound/burn image, and **AI-generated video walkthroughs** for every emergency. The frontend is fully responsive — it works on small phones (320px), tablets, and large desktop monitors (a vertical sidebar nav and multi-column grids appear on wide screens).

## Quick start

### 1. Install dependencies

```bash
npm install
```

This installs the only runtime dependency: `z-ai-web-dev-sdk` (the AI SDK for the doctor chat, vision analysis, and video generation). The backend uses **zero other dependencies** — the router, logger, persistence, and static file server are all built from Node.js built-ins.

> Requires Node.js 20 or newer.

### 2. Run the full app (recommended)

```bash
npm start
# or: node server/server.js
```

Then open **http://localhost:8787/firstminute.html** in your browser.

To use it from your phone on the same Wi-Fi, find your machine's LAN IP (e.g. `192.168.x.x`) and open `http://192.168.x.x:8787/firstminute.html`. Camera, mic, and geolocation require a secure context — see "Browser support" below; on a real deployment, host behind HTTPS.

**Configuration**: `PORT` (8787) · `HOST` (0.0.0.0) · `LOG_LEVEL` (info/debug/warn/error) · `LOG_FILE` (optional file path) · `DB_DIR` (data directory, defaults to `server/data`). Set environment variables in your shell or hosting platform; Node does not load `.env` automatically. See `.env.example`.

**AI provider credentials are required for image analysis and on-demand video generation.** The doctor uses Doc. Jr's offline retriever and deterministic safety checks; optional hosted classification uses `z-ai-web-dev-sdk` and falls back to retrieval if unavailable. Configure either a `.z-ai-config` JSON file in the project root or home directory, or set both `ZAI_BASE_URL` and `ZAI_API_KEY` in the hosting environment. Keep credentials private; `.z-ai-config` and `.env` are ignored by Git.

### Deploy with Docker

The included Dockerfile builds a production Node 22 image, runs as the unprivileged `node` user, and checks `/api/health`. Docker volumes persist the JSON database and generated video cache.

```bash
docker build -t firstminute .
docker volume create firstminute-data
docker volume create firstminute-videos
docker run -d --name firstminute --restart unless-stopped -p 8787:8787 --env-file .env --mount type=volume,source=firstminute-data,target=/app/server/data --mount type=volume,source=firstminute-videos,target=/app/download/videos firstminute
```

Set AI credentials in `.env` if needed. The JSON database supports a single server instance only. Add suitable access controls, rate limits, privacy/retention policies, and backups before public deployment or storing patient information. Use HTTPS for camera, microphone, and geolocation.

### 3. Static fallback (offline, no AI)

You can still open `firstminute.html` directly (`file://` or any static host). Everything works **except** the AI doctor chat, camera-vision analysis, and AI video walkthroughs — those tabs show a connection error and fall back to "call 112" guidance. All other features (12 emergencies, CPR, hospitals, report, reminders, basic camera capture) work offline because the frontend carries its own copy of the emergency + hospital data.

### 4. Run the tests

```bash
# All tests (unit + integration, spawns its own test server)
npm test
# or: node --test server/test/*.test.js

# Just the unit tests (data + lib, no server needed)
npm run test:unit

# Just the integration tests (spawns a server on port 9799)
npm run test:integration
```

### 5. Pre-generate all AI videos (optional)

```bash
npm run generate-videos
```

Builds all 12 demonstration videos offline (with rate-limit handling + resumable). Skips anything already cached in `download/videos/`.

## Features (all functional)

| # | Feature | Status |
|---|---|---|
| 1 | **Emergency selection** — tap a category or describe by voice (Web Speech API, `en-NG`) | ✅ |
| 2 | **Step-by-step guidance** — 12 emergencies, numbered checklist, tap to mark done | ✅ |
| 3 | **Alternative supplies** — what to use when standard kit is unavailable | ✅ |
| 4 | **CPR assistant** — audio+visual metronome at 110 bpm, 30:2 cycle, count + timer | ✅ |
| 5 | **Hospital finder** — 30 Nigerian teaching hospitals/FMCs, geolocation sort, click-to-call + map | ✅ |
| 6 | **Incident report** — structured form → shareable text for WhatsApp/SMS/email/copy | ✅ |
| 7 | **Follow-up reminders** — schedule check-ins via Notification API + localStorage | ✅ |
| 8 | **Camera aid** — wound/burn framing overlay, capture to device (stays local) | ✅ |
| 9 | **AI on-site doctor** — Doc. Jr governed triage with deterministic protocol instructions; life-threatening cases lead with "call 112" | ✅ *(needs backend)* |
| 10 | **Camera vision analysis** — captured image → VLM describes visible signs and suggests a first-aid category, with one tap to discuss with the AI doctor | ✅ *(needs backend)* |
| 11 | **AI video walkthroughs** — each emergency has a short AI-generated demonstration video (CPR hand position, Heimlich, splinting, etc.); generated on first request, then cached for instant replay | ✅ *(needs backend)* |
| 12 | **Top 12 emergencies for Nigeria** + emergency numbers (112, 767, NEMA) | ✅ |

## How the AI works

**AI Doctor chat** (`POST /api/doctor`): uses the integrated Doc. Jr engine (`server/docjr/`). Its deterministic safety checks and RAG retriever select from ten governed protocol files; the optional LLM only classifies the emergency and suggests clarification questions. The LLM does not write first-aid instructions. Life-threatening signals trigger a deterministic 112 escalation, and the endpoint returns the existing `{ reply }` field plus structured `triage` metadata.

All current Doc. Jr protocols are drafts pending clinical review. Draft instructions are visibly marked during development; production (`NODE_ENV=production`) withholds them unless `FIRSTMINUTE_ALLOW_DRAFT_PROTOCOLS=true` is explicitly set. When no eligible protocol matches (including stroke and heat stroke, which are not covered by Doc. Jr yet), the doctor does not invent instructions and instead advises emergency escalation where appropriate. Set `FIRSTMINUTE_DOCJR_USE_LLM=false` to use offline deterministic retrieval only; the z-ai SDK remains used by vision and video features.

**Camera vision analysis** (`POST /api/analyze`): the captured image (base64 data URL) is sent to the GLM-4.6v vision model with a prompt that asks it to describe the visible injury type, size, location, colour, and severity signs, then suggest a likely first-aid category. The prompt enforces: no diagnosis, no "it's fine" reassurance, a retake request for unclear images, and a "call 112" prompt for anything that looks life-threatening. A "Discuss with AI doctor" button carries the vision result into the doctor chat for follow-up.

Both run through the backend, which also serves the static frontend and this README.

**AI video walkthroughs** (`POST /api/video/:id`, `GET /api/video-status/:id`, `GET /videos/:id.mp4`): each of the 12 emergencies has a curated prompt (`server/data/video-prompts.js`) that asks the CogVideoX-3 model to generate a 5-second, 1280×720 demonstration video. The prompts are deliberately clinical and instructional — they use training manikins, clean arm/leg props, and demonstrations of the physical actions (hand position for CPR, pressure on a wound, splinting with a magazine, the Heimlich thrust, the FAST stroke check, etc.). No real gore, no blood, no graphic injuries.

- **First request** triggers generation (≈1 minute); the frontend shows a "Generating…" modal with a progress bar and polls `/api/video-status/:id` every 4 seconds.
- The finished MP4 is downloaded once to `download/videos/<id>.mp4` and served from disk on every later request — instant replay, no re-generation.
- The video modal carries a caption (what the clip shows) and a hard disclaimer: it is visual guidance only, uses training props, and does not replace the written steps, the AI doctor, or professional care.
- `scripts/generate-videos.js` is an offline batch generator that pre-builds all 12 videos with rate-limit handling and is resumable (skips any video already on disk).

**Current video cache status:** the CPR and snake-bite walkthroughs are pre-generated and cached (`download/videos/cpr.mp4`, `download/videos/snake.mp4`). The other 10 are generated on-demand the first time a user opens that emergency and taps "Watch AI video walkthrough". If the video-generation API is rate-limited (HTTP 429), the server retries with exponential backoff; the frontend keeps polling and the video appears as soon as the API quota clears. To pre-build all 12 at once (outside the app), run `npm run generate-videos` — it skips anything already cached.

## Backend architecture

The backend in `server/` is a modular Node.js application (zero dependencies beyond the AI SDK and Node built-ins — no Express, no database server). It is organised into clear layers:

```
firstminute/
├── package.json            Scripts + the single z-ai-web-dev-sdk dependency
├── .env.example            Optional env-var template (copy to .env)
├── README.md               This file
├── server/
│   ├── server.js           Entry point: wires the router with all routes + static serving
│   ├── config.js           Central configuration (ports, dirs, limits, video options)
│   ├── lib/
│   │   ├── router.js       Method+pattern router with :params and /* wildcard
│   │   ├── http.js         readBody, readJSON, sendJSON, sendFile, haversine, pathId
│   │   ├── logger.js       Structured JSON logger (stdout + optional file)
│   │   ├── db.js           JSON-file persistence for incidents + reminders (atomic writes)
│   │   ├── videoStore.js   Video cache, marker files, generation jobs
│   │   └── zai.js          Singleton wrapper for z-ai-web-dev-sdk (LLM + VLM + video)
│   ├── data/
│   │   ├── emergencies.js   12 emergency first-aid protocols (single source of truth)
│   │   ├── hospitals.js    30 Nigerian teaching hospitals + state/distance queries
│   │   ├── video-prompts.js 12 curated clinical video-generation prompts + captions
│   │   ├── prompts.js      Doctor system prompt + vision-analyzer base prompt
│   │   └── db.json         Persistent incidents + reminders (auto-created)
│   ├── routes/
│   │   ├── doctor.js       POST /api/doctor          — Doc. Jr governed triage + protocol reply
│   │   ├── analyze.js      POST /api/analyze          — VLM camera-vision analysis
│   │   ├── video.js        GET/POST video endpoints   — status, start, stream MP4
│   │   ├── emergencies.js  GET /api/emergencies       — catalogue + search
│   │   ├── hospitals.js    GET /api/hospitals         — list, filter by state, sort by distance
│   │   ├── incidents.js    CRUD /api/incidents        — report + track incidents
│   │   ├── reminders.js    CRUD /api/reminders        — follow-up reminders
│   │   ├── health.js       GET /api/health + /stats   — liveness + counts
│   │   └── static.js       Serves the frontend + README (path-traversal safe)
│   ├── test/
│   │   ├── data.test.js        Unit tests for the data layer (11 tests)
│   │   ├── lib.test.js         Unit tests for router/http/db/videoStore (19 tests)
│   │   └── integration.test.js HTTP integration tests against a live server (43 tests)
│   └── docjr/
│       ├── src/                Integrated deterministic engine, retriever, safety, and classifier
│       └── protocols/          Ten governed protocol JSON files (currently draft)
├── download/
│   ├── firstminute.html    The responsive frontend (single file, ~140 KB)
│   ├── README.md           Copy of this README (served at /README.md)
│   └── videos/             Cached AI-generated MP4 walkthroughs (cpr.mp4, snake.mp4)
└── scripts/
    ├── server.js           Legacy backend; doctor route shares the Doc. Jr handler
    ├── generate-videos.js  Offline batch video generator (resumable)
    ├── video-prompts.js    Video prompt source (mirrors server/data/video-prompts.js)
    └── analyze-ui-reference.js  UI-reference analysis helper
```

> **Two entry points.** `server/server.js` is the modular backend (used by `npm start`). `scripts/server.js` is a legacy alternative; its doctor API delegates to the same Doc. Jr handler.

### REST API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness probe |
| GET | `/api/health/stats` | Counts + uptime + video cache status |
| POST | `/api/doctor` | Doc. Jr governed triage (`{message, history, context}` → `{reply, triage}`) |
| POST | `/api/analyze` | Camera-vision analysis (`{image, question?}` → `{description}`) |
| GET | `/api/emergencies` | List 12 emergencies (optional `?q=search`) |
| GET | `/api/emergencies/:id` | One emergency protocol |
| GET | `/api/hospitals` | List (optional `?state=&lat=&lng=&limit=`) |
| GET | `/api/hospitals/states` | Distinct states that have a hospital |
| GET | `/api/hospitals/:id` | One hospital |
| GET | `/api/incidents` | List all incidents (newest first) |
| POST | `/api/incidents` | Create an incident report |
| GET | `/api/incidents/:id` | One incident |
| PUT | `/api/incidents/:id` | Update incident fields |
| DELETE | `/api/incidents/:id` | Delete an incident |
| GET | `/api/reminders` | List all reminders |
| POST | `/api/reminders` | Create a reminder |
| GET | `/api/reminders/:id` | One reminder |
| DELETE | `/api/reminders/:id` | Delete a reminder |
| POST | `/api/reminders/:id/delivered` | Mark reminder delivered |
| GET | `/api/videos` | List all videos + cache status |
| GET | `/api/video/:id` | Status of one video |
| POST | `/api/video/:id` | Start video generation (idempotent) |
| GET | `/api/video-status/:id` | Poll video status (alias) |
| GET | `/videos/:id.mp4` | Stream the cached MP4 (HTTP range supported) |

All API responses are JSON with CORS headers (`Access-Control-Allow-Origin: *`), so the frontend can call any endpoint directly. Incidents and reminders persist across server restarts via an atomic-write JSON file (`server/data/db.json`).

### Design notes

- **Zero external dependencies** beyond `z-ai-web-dev-sdk`. The router, logger, persistence, and static file server are all built from Node built-ins — nothing else to install, nothing to break in an upgrade.
- **Single source of truth for data.** The 12 emergencies and 30 hospitals live in `server/data/` and are served via the API; the frontend carries its own copy for offline fallback, but the backend is authoritative.
- **Idempotent video generation.** Marker files (`.id.generating`) coordinate generation across the server process and the batch generator, so the status endpoint always reports the true state. Cached MP4s are streamed with HTTP range support for instant seeking.
- **Safety-first AI prompts.** The doctor system prompt enforces call-112-first for life-threatening cases, forbids recommending invasive procedures, and caps reply length. The vision prompt forbids diagnosis and demands a retake for unclear images.
- **Path-traversal safe.** Static file serving resolves and checks that the resolved path stays inside the download directory.
- **Fully responsive frontend.** Six breakpoints (≤360px small phones → ≥1440px large desktop). On wide screens the bottom nav becomes a vertical left sidebar and content grids expand to 2–4 columns.

## Emergency categories covered

1. Cardiac Arrest / CPR *(life-threatening)*
2. Cuts & Bleeding
3. Burns & Scalds
4. Head Injury *(life-threatening)*
5. Falls & Fractures
6. Poisoning *(life-threatening)*
7. Snake Bite *(life-threatening)*
8. Scorpion Sting
9. Choking *(life-threatening)*
10. Heat Stroke *(life-threatening)*
11. Stroke *(life-threatening)*
12. Seizure / Convulsion

Each includes: what it is, when to call 112, 6–8 numbered steps, 3–4 alternative-supply suggestions, and next-step buttons (start report / find hospital / set reminder / ask AI doctor).

## Browser support

| Feature | Chrome/Edge | Safari (iOS) | Firefox |
|---|---|---|---|
| All UI, search, checklist, report, reminders | ✅ | ✅ | ✅ |
| Voice input (Web Speech API) | ✅ | ✅ (iOS 14.5+) | ⚠ partial |
| Camera aid + vision analysis | ✅ (HTTPS) | ✅ (HTTPS) | ✅ (HTTPS) |
| Geolocation hospital sort | ✅ (HTTPS) | ✅ (HTTPS) | ✅ (HTTPS) |
| Notifications (reminders) | ✅ | ✅ (iOS 16.4+) | ✅ |
| CPR audio metronome | ✅ | ✅ (user gesture) | ✅ |
| AI doctor chat | ✅ | ✅ | ✅ |
| AI video walkthroughs | ✅ | ✅ | ✅ |

HTTPS is required by browsers for camera, mic, and geolocation. The AI doctor chat works over plain HTTP on localhost, but for a phone on the same Wi-Fi you should serve over HTTPS (or use a tunnel like `ngrok`/`cloudflared` for testing) so camera features unlock.

## What's intentionally NOT in this MVP

- **Account / login.** Reports and reminders are local to the device for now.
- **Hospital dashboard.** The report is shared peer-to-peer (WhatsApp/SMS/email) for now; a hospital-facing dashboard is a later phase.
- **iOS native app.** Web first, then Android, then iOS.
- **AI as a replacement for a clinician.** The AI doctor and vision analysis support, but never replace, professional care. They never diagnose and always defer to 112 / a hospital for serious cases.

## Medical disclaimer

FirstMinute provides general first-aid guidance for lay responders. It is **not a substitute for professional medical care**. The AI doctor and camera-vision analysis are decision-support tools, not diagnostic tools — they never replace a trained clinician. Always call **112** for serious or life-threatening situations. Every screen carries this reminder.

## Roadmap to the Android app (next phase)

1. **Wrap this web build** in a WebView (Capacitor / TWA) for an instant installable Android APK — gets the app into hands in days. The Node backend becomes a small cloud service the app calls.
2. **Native CPR metronome** using a foreground service so it keeps running when the screen is off.
3. **Offline bundle** of all emergency content + hospital list (already all client-side, so this is mostly a packaging step). AI features gracefully degrade when offline.
4. **Background reminders** via Android WorkManager instead of browser Notifications.
5. **Camera AR overlay** for CPR hand position (ARCore) and wound measurement — the "AR-like visual guidance" we discussed.
6. **Hospital dashboard** backend: a simple API hospitals log into to receive incident reports, with bed/triage status.
7. **AI model fine-tuning** on Nigerian emergency-response protocols and local language support (Hausa, Yoruba, Igbo, Pidgin) for the doctor chat.
8. **Partnerships**: integrate certified hospital directories per state, link to state emergency services (LASAMBUS, etc.), then expand beyond Nigeria.

## Source data note

First-aid steps are based on Red Cross / WHO lay first-aid principles. Hospital coordinates are approximate centroids of major teaching hospitals and Federal Medical Centres; phone numbers are illustrative and **must be verified** before any production release — they change and many hospitals publish multiple lines. A real release needs a maintained hospital directory, ideally in partnership with NEMA or the Federal Ministry of Health.
