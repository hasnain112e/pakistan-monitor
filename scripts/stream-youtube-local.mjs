#!/usr/bin/env node
/**
 * OBS-free local launcher & FFmpeg streamer for Pakistan Monitor Broadcast Studio.
 *
 * Usage:
 *   npm run live:stream -- --preview
 *   npm run live:stream -- --preview out.mp4
 *   YOUTUBE_STREAM_KEY=xxxx-xxxx npm run live:stream
 *   npm run live:stream -- --url http://localhost:3000/?broadcast=1 --duration 30
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const opts = {
    url: process.env.BROADCAST_URL || 'http://localhost:3000/?broadcast=1',
    preview: '',
    previewMode: false,
    streamKey: process.env.YOUTUBE_STREAM_KEY || '',
    rtmpBase: process.env.YOUTUBE_RTMP_URL || 'rtmp://a.rtmp.youtube.com/live2',
    fps: Number(process.env.STREAM_FPS || 30),
    videoBitrate: process.env.VIDEO_BITRATE || '3500k',
    audioDevice: process.env.PK_AUDIO_DEVICE || '',
    durationSec: 0,
    browserOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url' && argv[i + 1]) {
      opts.url = argv[++i];
    } else if (arg === '--preview') {
      opts.previewMode = true;
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        opts.preview = next;
        i++;
      } else {
        opts.preview = path.join(process.cwd(), 'pakistan-monitor-live-preview.mp4');
      }
    } else if (arg === '--stream-key' && argv[i + 1]) {
      opts.streamKey = argv[++i];
    } else if (arg === '--audio-device' && argv[i + 1]) {
      opts.audioDevice = argv[++i];
    } else if (arg === '--duration' && argv[i + 1]) {
      opts.durationSec = Math.max(1, Number(argv[++i]) || 0);
    } else if (arg === '--browser-only') {
      opts.browserOnly = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }
  return opts;
}

function printUsage() {
  console.log(`Pakistan Monitor 24/7 OBS-Free Streamer

Options:
  --url <url>            Broadcast URL (default: http://localhost:3000/?broadcast=1)
  --preview [file.mp4]   Record a local 1080p test MP4 instead of pushing to YouTube
  --stream-key <key>     YouTube Live stream key (or set YOUTUBE_STREAM_KEY env var)
  --audio-device <name>  Windows DirectShow / Linux Pulse audio device name (optional)
  --duration <seconds>   Auto-stop after N seconds (useful for preview smoke tests)
  --browser-only         Only launch the kiosk broadcast browser window (no FFmpeg)
`);
}

function findBrowserExecutable() {
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ]
      : ['chromium', 'chromium-browser', 'google-chrome', 'microsoft-edge'];

  for (const bin of candidates) {
    if (bin.includes('/') || bin.includes('\\')) {
      if (fs.existsSync(bin)) return bin;
    } else {
      const probe = spawnSync('which', [bin], { encoding: 'utf8' });
      if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
    }
  }
  return null;
}

function detectWindowsLoopbackAudio() {
  const probe = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'],
    { encoding: 'utf8' },
  );
  const output = `${probe.stdout || ''}\n${probe.stderr || ''}`;
  const matches = [...output.matchAll(/"([^"]+)"\s+\(audio\)/g)].map((m) => m[1]);
  const preferred = matches.find((name) => /stereo mix|virtual|cable|voicemeeter|loopback/i.test(name));
  return { preferred: preferred || '', allAudio: matches };
}

function buildFfmpegArgs(opts) {
  const args = ['-y', '-hide_banner', '-loglevel', 'warning'];

  if (process.platform === 'win32') {
    args.push('-thread_queue_size', '512', '-f', 'gdigrab', '-framerate', String(opts.fps), '-i', 'desktop');
    let audioDev = opts.audioDevice;
    if (!audioDev) {
      const detected = detectWindowsLoopbackAudio();
      audioDev = detected.preferred;
      if (!audioDev) {
        console.warn('[pk-live] No Windows Stereo Mix / Virtual Audio Cable loopback device detected; streaming silent AAC track locally.');
        console.warn('[pk-live] Tip: For unattended 24/7 voice+video on Windows, install VB-Audio Virtual Cable and pass --audio-device "CABLE Output (VB-Audio Virtual Cable)", or deploy Dockerfile.youtube-live on Railway/VPS (PulseAudio works automatically).');
      }
    }
    if (audioDev) {
      args.push('-thread_queue_size', '512', '-f', 'dshow', '-i', `audio=${audioDev}`);
    } else {
      args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
    }
  } else if (process.platform === 'linux') {
    const display = process.env.DISPLAY || ':0';
    args.push('-thread_queue_size', '512', '-f', 'x11grab', '-video_size', '1920x1080', '-framerate', String(opts.fps), '-i', `${display}.0`);
    const pulseSource = opts.audioDevice || 'default';
    args.push('-thread_queue_size', '512', '-f', 'pulse', '-i', pulseSource);
  } else {
    args.push('-f', 'avfoundation', '-framerate', String(opts.fps), '-i', '1:0');
  }

  if (opts.durationSec > 0) {
    args.push('-t', String(opts.durationSec));
  }

  args.push(
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-b:v', opts.videoBitrate,
    '-maxrate', opts.videoBitrate,
    '-bufsize', '7000k',
    '-pix_fmt', 'yuv420p',
    '-g', String(opts.fps * 2),
    '-keyint_min', String(opts.fps * 2),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
  );

  if (opts.previewMode) {
    args.push('-movflags', '+faststart', opts.preview);
  } else {
    const target = `${opts.rtmpBase}/${opts.streamKey}`;
    args.push('-f', 'flv', target);
  }
  return args;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.browserOnly && !opts.previewMode && !opts.streamKey) {
    console.error('[pk-live] Provide YOUTUBE_STREAM_KEY (or --stream-key <key>), or use --preview / --browser-only.');
    printUsage();
    process.exit(1);
  }

  const browserBin = findBrowserExecutable();
  if (!browserBin) {
    console.error('[pk-live] Could not find Chrome, Chromium, or Microsoft Edge on this system.');
    process.exit(1);
  }

  const profileDir = path.join(process.cwd(), '.tmp-pk-broadcast-profile');
  fs.mkdirSync(profileDir, { recursive: true });

  console.log(`[pk-live] Launching Broadcast Studio: ${opts.url}`);
  const browserProc = spawn(
    browserBin,
    [
      '--new-window',
      '--kiosk',
      '--window-size=1920,1080',
      '--window-position=0,0',
      '--autoplay-policy=no-user-gesture-required',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--disable-infobars',
      opts.url,
    ],
    { stdio: 'ignore', detached: false },
  );

  let ffmpegProc = null;
  const shutdown = () => {
    if (ffmpegProc && !ffmpegProc.killed) ffmpegProc.kill('SIGINT');
    if (browserProc && !browserProc.killed) browserProc.kill();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (opts.browserOnly) {
    console.log('[pk-live] Running in --browser-only mode. Press Ctrl+C to close.');
    await new Promise((resolve) => browserProc.once('exit', resolve));
    return;
  }

  // Wait for Broadcast Studio overlay to auto-open and fetch initial feed
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const ffmpegArgs = buildFfmpegArgs(opts);
  const destinationLabel = opts.previewMode ? opts.preview : `${opts.rtmpBase}/***`;
  console.log(`[pk-live] Streaming 1080p H.264/AAC via FFmpeg -> ${destinationLabel}`);

  ffmpegProc = spawn('ffmpeg', ffmpegArgs, { stdio: 'inherit' });
  const code = await new Promise((resolve) => ffmpegProc.once('exit', (c) => resolve(c ?? 0)));

  shutdown();
  process.exit(code);
}

main().catch((err) => {
  console.error('[pk-live] Fatal error:', err);
  process.exit(1);
});

