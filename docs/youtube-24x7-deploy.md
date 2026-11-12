# 24/7 OBS-Free YouTube Live Deployment Guide — Pakistan Monitor AI News

Pakistan Monitor includes a built-in **AI News Broadcast Studio** (`?broadcast=1`) with:
- Full `1920x1080` television layout (live ticker, crisis telemetry, audio waveform, bilingual Urdu/English captions, AI Anchor desk).
- Free neural Pakistani Urdu & English speech synthesis (`POST /api/pk-anchor-tts` powered by Microsoft `edge-tts`: `ur-PK-UzmaNeural` and `en-GB-RyanNeural`, with automatic browser speech fallback).
- Zero OBS required: Chromium renders `?broadcast=1`, PulseAudio captures its audio cleanly on Linux, and FFmpeg pushes `1080p 30fps` H.264 + AAC directly to `rtmp://a.rtmp.youtube.com/live2/$YOUTUBE_STREAM_KEY` in an auto-reconnecting loop.

---

## Why a Container Host (Railway / Fly.io / VPS) Instead of Vercel?

Vercel and static hosts only run short-lived serverless requests and cannot keep a 24/7 `ffmpeg` RTMP stream open. Use [Dockerfile.youtube-live](../Dockerfile.youtube-live) on any Docker container host (Railway, Fly.io, Render, or a \$5 Linux VPS with 2 GB RAM / 2 vCPU recommended).

---

## Option 1: Deploy 24/7 on Cloud (Railway / Fly.io / Docker VPS)

### 1. Get your YouTube Live Stream Key
1. Open [YouTube Studio](https://studio.youtube.com) -> **Create** -> **Go Live**.
2. Copy your **Stream key** (under Stream Settings -> Stream URL `rtmp://a.rtmp.youtube.com/live2`).
3. Ensure **Auto-start** is enabled in YouTube Studio so the channel goes live whenever FFmpeg connects.

### 2. Deploy via Docker (Any VPS / Server)
```bash
docker build -f Dockerfile.youtube-live -t pakistan-monitor-live .
docker run -d --restart unless-stopped \
  -e YOUTUBE_STREAM_KEY="YOUR_YOUTUBE_STREAM_KEY" \
  --name pk-ai-live \
  pakistan-monitor-live
```

### 3. Deploy on Railway (Recommended Zero-Maintenance 24/7)
1. Push this repo (`pm/day1`) to GitHub.
2. Create a new project in Railway -> **Deploy from GitHub Repo** -> select `hasnain112e/pakistan-monitor`.
3. In Railway Service Settings -> **Dockerfile Path**, set `Dockerfile.youtube-live`.
4. Add environment variable:
   - `YOUTUBE_STREAM_KEY` = your YouTube Live key
   - Optional: `VIDEO_BITRATE=3500k`, `STREAM_FPS=30`
5. Deploy. Check logs for `[pk-live] Starting 24/7 FFmpeg RTMP stream loop...`.

---

## Option 2: Test or Run Directly From Your PC (No OBS)

Start the Pakistan Monitor app first:
```bash
npm run dev
```

Open the Broadcast Studio directly with auto-start (no clicks required):
```
http://localhost:3000/?broadcast=1
```

Or run the built-in CLI streamer ([scripts/stream-youtube-local.mjs](../scripts/stream-youtube-local.mjs)):

```bash
# 1. Just open the fullscreen kiosk broadcast window with auto-play anchor voice:
npm run live:stream -- --browser-only

# 2. Record a 20-second local 1080p MP4 preview:
npm run live:stream -- --preview --duration 20

# 3. Push directly to YouTube Live from your machine:
YOUTUBE_STREAM_KEY="YOUR_YOUTUBE_STREAM_KEY" npm run live:stream
```

> **Windows Audio Note:** On Linux/Docker, PulseAudio captures browser audio automatically (`pk_sink.monitor`). On Windows, if Stereo Mix is disabled, pass `--audio-device "CABLE Output (VB-Audio Virtual Cable)"` after installing VB-Audio Virtual Cable so desktop audio is captured cleanly alongside `gdigrab`.

---

## Monetization & Policy Notes for YouTube AI News Channels

- Keep the on-screen broadcast attribution disclaimer enabled (`Pakistan Monitor AI Broadcast Desk` source ticker + synthetic voice disclosure).
- Add YouTube Studio's **"Altered or synthetic content"** disclosure toggle if required by current YouTube Partner Program guidelines, and pair aggregated headlines with analytical commentary and regional visual telemetry (map, PSX, FX/gold, weather/seismic panels) for transformative value.

