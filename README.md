# 🌕 Hunter's Moon 2026 — Three.js / WebGL video, rendered in GitHub Actions

An 8-minute (480 s) cinematic explainer for the **Hunter's Moon — Monday, Oct 26, 2026, 04:12 UTC** (9:42 AM IST, 12:12 AM New York, 4:12 AM London). Every frame is real-time WebGL (three.js), rendered deterministically frame-by-frame, then encoded with FFmpeg.

| Output | Resolution | Length | Notes |
|---|---|---|---|
| `HuntersMoon_1080p.mp4` | 1920×1080 | 8:00 | H.264 CRF16, AAC 320k |
| `HuntersMoon_4k.mp4` | 3840×2160 | 8:00 | H.264 CRF15 |
| `HuntersMoon_shorts.mp4` | 1080×1920 (9:16) | 0:58 | Dedicated vertical edit with Shorts safe zones |
| `thumbnail_*.png`, `captions_*.srt/.vtt`, `upload_kit.md` | | | Title options, chapters, description, tags, pinned comment |

## Run it (GitHub)
1. Create a repo, push this folder, open **Actions → "Render Hunter's Moon video" → Run workflow**.
2. First run **"Smoke test"** (≈10 min, 12 s at 540p) to confirm your runners work.
3. Then tick 1080p / 4K / Shorts, set **publish date** (drives the "IN N DAYS" countdown and thumbnail chip) and run. Download from the run's **Artifacts** (or tick *create_release*).

The job fans out into parallel shards (default 20 for 1080p, 48 for 4K, 4 for Shorts), then stitches shards (stream-copy) and muxes audio.

### ⚠️ Compute reality (measured)
GitHub-hosted runners have **no GPU**, so WebGL runs on SwiftShader (CPU). On a 2-core test box I measured ≈4 s/frame at 1080p (≈16 CPU-hours for the full film), ≈4× that at 4K. Splitting across shards makes wall-clock manageable, but:
- Use a **public repo** (free minutes) — or budget for it: 4K ≈ 60+ runner-hours; private repos only include 2,000 free min/month.
- Free accounts run ~20 jobs at once; the rest queue. Expect roughly 1–2 h for 1080p, 4–6 h for 4K.
- Cheaper: `fps=24` (−20%), render Shorts + 1080p only, or use GPU/large runners (`GL_BACKEND=default` env on a self-hosted GPU runner makes it many times faster).

## Narration & music
- Music is an **original synthesized ambient score** (no copyright issues).
- Narration uses `edge-tts` (Microsoft neural voices, free, needs internet — fine on Actions). Voice: `en-GB-RyanNeural` (change in workflow input). Offline fallback `espeak` is robotic; `none` = music only. Narration is auto-timed to the on-screen cards, auto-ducks the music, and the same text becomes your SRT captions.
- Audio and captions were tested with a stand-in tone voice here; the real TTS step runs in CI (I couldn't reach Microsoft's service from my sandbox).

## Local use
```bash
npm ci && npx puppeteer browsers install chrome-headless-shell
npm run dev                      # live preview: http://127.0.0.1:8080/?autoplay=1&profile=full  (&profile=short&w=1080&h=1920)
node render/render.mjs --res 1080p --still 10,60,150 --out build/stills   # test frames (seconds)
node render/render.mjs --res 540p --limit 20                              # 20 s quick render
node render/profile.mjs --res 1080p                                       # per-scene cost
```
Env: `CHROME_PATH` (custom Chrome), `GL_BACKEND` (swiftshader|default), `HEADLESS=new`.

## What's in the film (timeline in `src/timeline.js`)
Hook countdown → Peak date/time + world clocks → Why "Hunter's Moon" (1710 OED, other names, no eclipse) → Harvest vs Hunter orbit diagram (13°/night) → 5-night moonrise time-lapse → Moon flyover (maria, Apollo 11 site, Tycho, 368,872 km, not a supermoon) → Orange Moon & Moon illusion → Sky calendar on a real star map (Orionids, Saturn, Pleiades, Orion) → How to watch → CTA. Engagement prompts (comment/like/share/reminder/subscribe) appear at set times.

Edit text/timing/facts in `src/timeline.js` only; visuals live in `src/scenes/`.

## Known limits
- Textures are 1K–2K (Moon upscaled + procedural craters); drop in a NASA map (see CREDITS) for the sharpest 4K close-ups.
- Moon sizes/paths in the sky chart are exaggerated for readability; orbit diagram is labelled "not to scale".
- Moonrise "~30 min later" holds for mid-northern latitudes; peak times shown are for the listed cities.
- The GitHub workflow is syntax-validated and each stage (shard render → stitch → mux, audio, thumbnail, metadata) was tested locally, but I couldn't execute it on GitHub itself — run the smoke test first.
