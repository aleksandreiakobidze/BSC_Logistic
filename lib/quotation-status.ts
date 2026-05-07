import { QuotationStatus } from "./enums";

/**
 * Quotation lifecycle state machine.
 *
 * High-level flow:
 *   PRICING ──Generate Quote──► DRAFT ──Send──► SENT ──┬─► ACCEPTED ──Convert──► CONVERTED ──Won──► WON
 *                                                      ├─► COUNTERED ──(admin counter)──► SENT
 *                                                      └─► REJECTED ──Lost──► LOST
 *
 * `WON` / `LOST` co-exist with the legacy `CONVERTED` / `REJECTED`. Mark Won
 * stamps `wonAt` and either keeps `CONVERTED` (if already converted) or sets
 * `WON`. Mark Lost stamps `lostAt` and sets `LOST`. Reports continue to use
 * `wonAt IS NOT NULL` (mirroring the lead-pipeline contract).
 */

export type QuotationStatusValue = (typeof QuotationStatus)[keyof typeof QuotationStatus];

export type QuotationForCheck = {
  status: QuotationStatusValue;
  selectedOffersCount: number;
  linesCount: number;
  hasPortalUser: boolean;
};

export type TransitionTarget = Exclude<
  QuotationStatusValue,
  typeof QuotationStatus.PRICING
>;

export type TransitionError =
  | { code: "INVALID_TRANSITION"; from: QuotationStatusValue; to: TransitionTarget }
  | { code: "TERMINAL"; status: QuotationStatusValue }
  | { code: "NO_SELECTED_OFFER" }
  | { code: "NO_LINES" }
  | { code: "NO_PORTAL_USER" }
  | { code: "NOT_ACCEPTED" };

const TERMINAL_STATUSES = new Set<QuotationStatusValue>([
  QuotationStatus.WON,
  QuotationStatus.LOST,
  QuotationStatus.CANCELLED,
  QuotationStatus.EXPIRED,
]);

const ALLOWED: Record<QuotationStatusValue, TransitionTarget[]> = {
  [QuotationStatus.PRICING]: [
    QuotationStatus.DRAFT,
    QuotationStatus.LOST,
    QuotationStatus.CANCELLED,
  ],
  [QuotationStatus.DRAFT]: [
    QuotationStatus.SENT,
    QuotationStatus.ACCEPTED,
    QuotationStatus.REJECTED,
    QuotationStatus.LOST,
    QuotationStatus.CANCELLED,
  ],
  [QuotationStatus.SENT]: [
    QuotationStatus.ACCEPTED,
    QuotationStatus.REJECTED,
    QuotationStatus.COUNTERED,
    QuotationStatus.LOST,
    QuotationStatus.CANCELLED,
  ],
  [QuotationStatus.COUNTERED]: [
    QuotationStatus.SENT,
    QuotationStatus.ACCEPTED,
    QuotationStatus.REJECTED,
    QuotationStatus.LOST,
    QuotationStatus.CANCELLED,
  ],
  [QuotationStatus.ACCEPTED]: [
    QuotationStatus.CONVERTED,
    QuotationStatus.WON,
    QuotationStatus.CANCELLED,
  ],
  [QuotationStatus.REJECTED]: [QuotationStatus.LOST],
  [QuotationStatus.CONVERTED]: [QuotationStatus.WON],
  [QuotationStatus.EXPIRED]: [],
  [QuotationStatus.CANCELLED]: [],
  [QuotationStatus.WON]: [],
  [QuotationStatus.LOST]: [],
};

export function isTerminal(status: QuotationStatusValue): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isEditable(status: QuotationStatusValue): boolean {
  return (
    status === QuotationStatus.PRICING ||
    status === QuotationStatus.DRAFT ||
    status === QuotationStatus.COUNTERED
  );
}

export function getAllowedTransitions(
  status: QuotationStatusValue,
): TransitionTarget[] {
  return ALLOWED[status] ?? [];
}

/**
 * Pure check: would this transition be allowed given the quotation's current
 * shape? Returns `{ ok: true }` when all gates pass, otherwise a structured
 * error so callers can render the right CTA / dialog.
 */
export function checkQuotationTransition(
  q: QuotationForCheck,
  next: TransitionTarget,
): { ok: true } | { ok: false; error: TransitionError } {
  const allowed = ALLOWED[q.status];
  if (allowed.length === 0) {
    return { ok: false, error: { code: "TERMINAL", status: q.status } };
  }
  if (!allowed.includes(next)) {
    return {
      ok: false,
      error: { code: "INVALID_TRANSITION", from: q.status, to: next },
    };
  }

  if (q.status === QuotationStatus.PRICING && next === QuotationStatus.DRAFT) {
    if (q.selectedOffersCount < 1) {
      return { ok: false, error: { code: "NO_SELECTED_OFFER" } };
    }
  }

  if (
    next === QuotationStatus.SENT &&
    (q.status === QuotationStatus.DRAFT ||
      q.status === QuotationStatus.COUNTERED)
  ) {
    if (q.linesCount < 1) {
      return { ok: false, error: { code: "NO_LINES" } };
    }
    if (!q.hasPortalUser) {
      return { ok: false, error: { code: "NO_PORTAL_USER" } };
    }
  }

  if (next === QuotationStatus.WON) {
    if (
      q.status !== QuotationStatus.ACCEPTED &&
      q.status !== QuotationStatus.CONVERTED
    ) {
      return { ok: false, error: { code: "NOT_ACCEPTED" } };
    }
  }

  return { ok: true };
}
