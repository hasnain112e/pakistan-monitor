/**
 * Historical-playback gate (#5632) — the reactive half (#5813).
 *
 * `playback-resolver.ts` next door is the pure decision chain, testable under
 * `tsx --test` with no DOM. This module is its reader.
 *
 * Split out of `panel-gating.ts` (#5813). See the note in `export.ts` on why
 * the two gates deliberately do NOT share a factory.
 */

import type { AuthSession } from '../auth-state';
import type { PlaybackGateVerdict } from './playback-resolver';

/** Current playback-control verdict for the given auth session. */
export function evaluatePlaybackGate(_authState: AuthSession): PlaybackGateVerdict {
  return 'visible';
}
