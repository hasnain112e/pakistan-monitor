#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${YOUTUBE_STREAM_KEY:-}" ]]; then
  echo "[pk-live] ERROR: YOUTUBE_STREAM_KEY environment variable is required." >&2
  exit 1
fi

RTMP_INGEST="${YOUTUBE_RTMP_URL:-rtmp://a.rtmp.youtube.com/live2}/${YOUTUBE_STREAM_KEY}"
BROADCAST_URL="${BROADCAST_URL:-http://127.0.0.1:3000/?broadcast=1}"
VIDEO_BITRATE="${VIDEO_BITRATE:-3500k}"
AUDIO_BITRATE="${AUDIO_BITRATE:-128k}"
FPS="${STREAM_FPS:-30}"
RESOLUTION="1920x1080"

export DISPLAY=":99"
export HOME="${HOME:-/tmp}"
export PULSE_SERVER="unix:/tmp/pulse-pk/native"

cleanup() {
  echo "[pk-live] Shutting down..."
  for pid in "${FFMPEG_PID:-}" "${CHROME_PID:-}" "${SERVER_PID:-}" "${XVFB_PID:-}"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  pulseaudio --kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

mkdir -p /tmp/pulse-pk /tmp/chrome-pk-profile

echo "[pk-live] Starting PulseAudio virtual broadcast sink..."
pulseaudio -D --exit-idle-time=-1 --disable-shm=yes --disallow-exit=yes 2>/dev/null || true
pactl load-module module-native-protocol-unix socket=/tmp/pulse-pk/native auth-anonymous=1 >/dev/null 2>&1 || true
pactl load-module module-null-sink sink_name=pk_sink sink_properties=device.description=PakistanMonitorLive >/dev/null 2>&1 || true
pactl set-default-sink pk_sink >/dev/null 2>&1 || true

echo "[pk-live] Starting virtual 1080p display (${DISPLAY})..."
Xvfb "${DISPLAY}" -screen 0 "${RESOLUTION}x24" -ac +extension GLX +render -noreset >/tmp/xvfb.log 2>&1 &
XVFB_PID=$!

if [[ -z "${BROADCAST_URL_EXTERNAL:-}" ]]; then
  echo "[pk-live] Starting Pakistan Monitor local server on 127.0.0.1:3000..."
  npx vite --host 127.0.0.1 --port 3000 >/tmp/vite.log 2>&1 &
  SERVER_PID=$!

  for _ in $(seq 1 45); do
    if curl -fsS "http://127.0.0.1:3000/" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
fi

CHROME_BIN="${CHROME_BIN:-$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)}"
if [[ -z "${CHROME_BIN}" ]]; then
  echo "[pk-live] ERROR: Chromium binary not found." >&2
  exit 1
fi

echo "[pk-live] Launching Chromium studio at ${BROADCAST_URL}..."
"${CHROME_BIN}" \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  --kiosk \
  --window-size=1920,1080 \
  --window-position=0,0 \
  --autoplay-policy=no-user-gesture-required \
  --user-data-dir=/tmp/chrome-pk-profile \
  --no-first-run \
  --disable-infobars \
  --disable-background-timer-throttling \
  --disable-renderer-backgrounding \
  "${BROADCAST_URL}" >/tmp/chromium.log 2>&1 &
CHROME_PID=$!

# Give the broadcast studio time to auto-open and load initial telemetry + anchor voice
sleep 8

echo "[pk-live] Starting 24/7 FFmpeg RTMP stream loop..."
while true; do
  ffmpeg -y -hide_banner -loglevel warning \
    -thread_queue_size 512 -f x11grab -video_size "${RESOLUTION}" -framerate "${FPS}" -i "${DISPLAY}.0" \
    -thread_queue_size 512 -f pulse -i pk_sink.monitor \
    -c:v libx264 -preset veryfast -tune zerolatency \
    -b:v "${VIDEO_BITRATE}" -maxrate "${VIDEO_BITRATE}" -bufsize "7000k" \
    -pix_fmt yuv420p -g "$((FPS * 2))" -keyint_min "$((FPS * 2))" \
    -c:a aac -b:a "${AUDIO_BITRATE}" -ar 44100 -ac 2 \
    -f flv "${RTMP_INGEST}" || true

  echo "[pk-live] FFmpeg disconnected; reconnecting in 5s..."
  sleep 5
done

