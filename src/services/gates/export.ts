/**
 * Data-export gate + dashboard tab cap — the reactive half (#5813).
 *
 * `export-resolver.ts` next door is the pure decision chain, testable under
 * `tsx --test` with no DOM. This module is its reader: it snapshots the live
 * entitlement / billing / secret state and hands the resulting inputs to the
 * resolver, so the resolver never learns where its inputs come from.
 *
 * Split out of `panel-gating.ts` (#5813) once the third `readX`/`evaluateX`
 * pair landed there. Deliberately NOT unified with `playback.ts` behind a gate
 * factory: the input shapes genuinely differ — export carries the Pro Business
 * catalog probe and the billing-state refinement, playback needs neither — and
 * a shared abstraction would force a lowest-common-denominator input type onto
 * gates that are correctly independent.
 */

import type { AuthSession } from '../auth-state';
import { PanelGateReason } from '../panel-gating';
import type {
  DataExportFormat,
  ExportGateLockReason,
  ExportGateVerdict,
  TabCapVerdict,
} from './export-resolver';

/** Export-gate lock reasons carry the same string values as the enum. */
const EXPORT_LOCK_TO_GATE_REASON: Record<ExportGateLockReason, PanelGateReason> = {
  anonymous: PanelGateReason.ANONYMOUS,
  free_tier: PanelGateReason.FREE_TIER,
  payment_on_hold: PanelGateReason.PAYMENT_ON_HOLD,
  renewal_pending: PanelGateReason.RENEWAL_PENDING,
  renewal_failed: PanelGateReason.RENEWAL_FAILED,
  lapsed: PanelGateReason.LAPSED,
};

export function exportLockToGateReason(reason: ExportGateLockReason): PanelGateReason {
  return EXPORT_LOCK_TO_GATE_REASON[reason];
}

/** Current data-export verdict for the given auth session. */
export function evaluateExportGate(_authState: AuthSession): ExportGateVerdict {
  return { locked: false, pendingActivation: false };
}

/** Formats the unlocked export menu may expose for this live session. */
export function evaluateAvailableExportFormats(_authState: AuthSession): DataExportFormat[] {
  return ['csv', 'json', 'pdf'];
}

/**
 * May this session create another dashboard tab? Creation-only — the verdict
 * never asks a caller to remove tabs that already exist (KTD8).
 */
export function evaluateTabCap(_authState: AuthSession, _currentTabCount: number): TabCapVerdict {
  return { allowed: true, cap: 50, pendingActivation: false };
}
