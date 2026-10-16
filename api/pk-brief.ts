/**
 * Pakistan Monitor AI brief.
 *
 * POST /api/pk-brief  { headlines: string[] }  ->  { bullets, provider, model, generatedAt }
 *
 * Tries a local Ollama (PK_BRIEF_OLLAMA_URL), then any OpenAI-compatible endpoint
 * such as Groq (PK_BRIEF_LLM_URL / PK_BRIEF_LLM_KEY / PK_BRIEF_LLM_MODEL). Answers
 * 503 when none responds; the panel then shows the raw headlines labelled "LLM offline".
 *
 * These are deliberately not OLLAMA_API_URL / LLM_API_URL: setting those switches
 * on upstream's own server LLM work (digest classification), which saturates a
 * local CPU model and starves the brief.
 */

export const config = { runtime: 'edge' };

// @ts-expect-error — JS module, no declaration file
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
// @ts-expect-error — JS module, no declaration file
import { jsonResponse } from './_json-response.js';
import { stripThinkingTags } from '../server/_shared/llm';
import { sanitizeForPromptLine } from '../server/_shared/llm-sanitize.js';
import { checkRateLimit } from '../server/_shared/rate-limit';

const MAX_BODY_CHARS = 20_000;
const MAX_HEADLINES = 15;
const MAX_HEADLINE_CHARS = 300;
const BULLET_MARKER = /^(?:[-*•]|\d+[.)])\s+/;

const SYSTEM_PROMPT = [
  'You are the duty analyst for Pakistan Monitor, a situational-awareness dashboard.',
  'Summarize the Pakistan news headlines you are given into 3 to 5 bullet points for a busy reader.',
  'Use only facts stated in the headlines. Never invent numbers, names or events, and never add',
  'characterizations the headlines do not make (such as "sharply" or "record"). Merge duplicate stories.',
  'Write one sentence per bullet and start each bullet with "- ". Output only the bullets.',
].join('\n');

interface Endpoint { provider: string; url: string; model: string; key?: string; timeoutMs: number }

export function briefEndpoints(env: Record<string, string | undefined>): Endpoint[] {
  const endpoints: Endpoint[] = [];
  if (env.PK_BRIEF_OLLAMA_URL) {
    endpoints.push({
      provider: 'ollama',
      url: new URL('/v1/chat/completions', env.PK_BRIEF_OLLAMA_URL).toString(),
      model: env.PK_BRIEF_OLLAMA_MODEL || 'qwen2.5:3b-instruct',
      // A 3B model took 30-90s for 8 headlines on a busy laptop; the panel shows
      // the headlines meanwhile, and a local model costs nothing to wait for.
      timeoutMs: 120_000,
    });
  }
  if (env.PK_BRIEF_LLM_URL && env.PK_BRIEF_LLM_MODEL) {
    endpoints.push({
      provider: new URL(env.PK_BRIEF_LLM_URL).hostname,
      url: env.PK_BRIEF_LLM_URL,
      model: env.PK_BRIEF_LLM_MODEL,
      key: env.PK_BRIEF_LLM_KEY,
      timeoutMs: 20_000,
    });
  }
  return endpoints;
}

/** Model output -> at most 5 bullets. Prefers marked lines; falls back to plain lines. */
export function parseBullets(content: string): string[] {
  const lines = stripThinkingTags(content).split('\n').map((line) => line.trim()).filter(Boolean);
  const marked = lines.filter((line) => BULLET_MARKER.test(line));
  return (marked.length > 0 ? marked : lines)
    .map((line) => line.replace(BULLET_MARKER, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

function readHeadlines(body: unknown): string[] | null {
  const raw = (body as { headlines?: unknown } | null)?.headlines;
  if (!Array.isArray(raw)) return null;
  const headlines = raw
    .filter((h): h is string => typeof h === 'string')
    .map((h) => sanitizeForPromptLine(h.slice(0, MAX_HEADLINE_CHARS)))
    .filter(Boolean)
    .slice(0, MAX_HEADLINES);
  return headlines.length > 0 ? headlines : null;
}

async function complete(endpoint: Endpoint, headlines: string[], clientSignal: AbortSignal): Promise<string[]> {
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(endpoint.key ? { Authorization: `Bearer ${endpoint.key}` } : {}),
      },
      body: JSON.stringify({
        model: endpoint.model,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: headlines.map((h) => `- ${h}`).join('\n') },
        ],
      }),
      // A closed tab must free the model: Ollama serves one request at a time, so an
      // orphaned generation would make the next tab's brief queue behind it.
      signal: AbortSignal.any([clientSignal, AbortSignal.timeout(endpoint.timeoutMs)]),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = body.choices?.[0]?.message?.content;
    return typeof content === 'string' ? parseBullets(content) : [];
  } catch (error) {
    console.warn(`[pk-brief] ${endpoint.provider} failed:`, error instanceof Error ? error.message : error);
    return [];
  }
}

export default async function handler(req: Request): Promise<Response> {
  const cors = getCorsHeaders(req, 'POST, OPTIONS');
  if (isDisallowedOrigin(req)) return jsonResponse({ error: 'Origin not allowed' }, 403, cors);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, cors);

  // This route spends the operator's LLM credits, so a deployed instance must not
  // run without the Redis-backed limiter. Local dev (no Upstash) stays open.
  const limited = await checkRateLimit(req, cors, { failClosed: process.env.VERCEL === '1' });
  if (limited) return limited;

  const text = await req.text();
  if (text.length > MAX_BODY_CHARS) return jsonResponse({ error: 'Request too large' }, 413, cors);
  let headlines: string[] | null = null;
  try { headlines = readHeadlines(JSON.parse(text)); } catch { /* malformed JSON */ }
  if (!headlines) return jsonResponse({ error: 'Expected { headlines: string[] }' }, 400, cors);

  const noStore = { ...cors, 'Cache-Control': 'no-store' };
  const endpoints = briefEndpoints(process.env);
  if (endpoints.length === 0) return jsonResponse({ error: 'No LLM configured (PK_BRIEF_* in .env.local)' }, 503, noStore);
  for (const endpoint of endpoints) {
    const bullets = await complete(endpoint, headlines, req.signal);
    if (bullets.length > 0) {
      return jsonResponse({ bullets, provider: endpoint.provider, model: endpoint.model, generatedAt: new Date().toISOString() }, 200, noStore);
    }
  }
  return jsonResponse({ error: 'No LLM reachable' }, 503, noStore);
}
