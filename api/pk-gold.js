import { getCorsHeaders } from './_cors.js';
import { jsonResponse } from './_json-response.js';

export const config = { runtime: 'edge' };

// Stub registered by Task 0; Track B implements it in B6.
export default async function handler(req) {
  return jsonResponse({ error: 'Not implemented yet' }, 501, getCorsHeaders(req));
}
