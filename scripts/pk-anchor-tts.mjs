import { spawn } from 'node:child_process';

const MAX_TEXT_CHARS = 800;

const PYTHON_STREAM_SCRIPT = `
import asyncio, sys, edge_tts

async def main():
    text = sys.stdin.read().strip()
    if not text:
        return
    voice = sys.argv[1]
    rate = sys.argv[2]
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio":
            sys.stdout.buffer.write(chunk["data"])
            sys.stdout.buffer.flush()

asyncio.run(main())
`.trim();

/**
 * Resolve Microsoft Edge neural voice for Pakistan Monitor anchor speech.
 * @param {string} [speechLang]
 * @returns {string}
 */
export function resolveAnchorVoice(speechLang = 'en-PK') {
  const normalized = String(speechLang || 'en-PK').toLowerCase();
  if (normalized.startsWith('ur')) return 'ur-PK-UzmaNeural';
  return 'en-GB-RyanNeural';
}

/**
 * Format speed multiplier (0.7..1.5) into edge-tts percentage rate string.
 * @param {number} [speed]
 * @returns {string}
 */
export function formatEdgeTtsRate(speed) {
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed === 1) return '+0%';
  const pct = Math.round((Math.min(1.5, Math.max(0.7, speed)) - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

/**
 * @param {string} pythonBin
 * @param {string} text
 * @param {string} voice
 * @param {string} rate
 * @param {AbortSignal} [signal]
 * @returns {Promise<Buffer>}
 */
function runPythonEdgeTts(pythonBin, text, voice, rate, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, ['-c', PYTHON_STREAM_SCRIPT, voice, rate], {
      stdio: ['pipe', 'pipe', 'pipe'],
      signal,
    });
    /** @type {Buffer[]} */
    const chunks = [];
    /** @type {Buffer[]} */
    const errChunks = [];

    child.stdout.on('data', (d) => chunks.push(Buffer.from(d)));
    child.stderr.on('data', (d) => errChunks.push(Buffer.from(d)));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        const stderr = Buffer.concat(errChunks).toString('utf8').trim();
        reject(new Error(stderr || `edge_tts exited with code ${code}`));
      }
    });

    child.stdin.write(text);
    child.stdin.end();
  });
}

/**
 * Synthesize anchor speech audio (MP3) using Python edge-tts.
 * @param {{ text: string; lang?: string; speed?: number; signal?: AbortSignal }} opts
 * @returns {Promise<{ audio: Buffer; voice: string }>}
 */
export async function synthesizeAnchorSpeech(opts) {
  const cleanText = String(opts?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS);
  if (!cleanText) throw new Error('Text is required');

  const voice = resolveAnchorVoice(opts?.lang ?? 'en-PK');
  const rate = formatEdgeTtsRate(opts?.speed);

  const candidates = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
  /** @type {unknown} */
  let lastError;
  for (const bin of candidates) {
    try {
      const audio = await runPythonEdgeTts(bin, cleanText, voice, rate, opts?.signal);
      return { audio, voice };
    } catch (err) {
      lastError = err;
      const code = typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined;
      if (code === 'ENOENT') continue;
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Python edge-tts unavailable');
}
