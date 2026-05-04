import type {
  QuotationVersion,
  VersionLine,
} from "@/components/app/quotation-versions-view";
import type { RevisionSnapshot } from "@/lib/quotations";

/**
 * Raw shape of a `QuotationRevision` row as selected by the page queries.
 * Includes the JSON snapshot string and an optional joined author.
 */
export type RawRevision = {
  id: string;
  version: number;
  source: string;
  message: string | null;
  createdAt: Date;
  total: number | string | { toString(): string };
  currency: string;
  linesJson: string;
  author?: { name: string | null; email: string | null } | null;
};

/**
 * Optional "live" working-copy snapshot. Only the admin page passes this so
 * staff can compare the most-recent revision to whatever's currently in
 * `QuotationLine`. Customers only see finalized revisions.
 */
export type LiveSnapshot = {
  total: number;
  currency: string;
  lines: VersionLine[];
};

/**
 * Convert raw `QuotationRevision` rows (with `linesJson` populated) plus an
 * optional live working copy into a normalized `QuotationVersion[]` ready for
 * `QuotationVersionsView`. Skips revisions whose `linesJson` fails to parse —
 * they shouldn't exist in practice but we guard against bad data anyway.
 */
export function buildVersionsFromRevisions(
  revisions: RawRevision[],
  live: LiveSnapshot | null,
): QuotationVersion[] {
  const out: QuotationVersion[] = [];
  for (const r of revisions) {
    let snap: RevisionSnapshot | null = null;
    try {
      snap = JSON.parse(r.linesJson) as RevisionSnapshot;
    } catch {
      snap = null;
    }
    if (!snap) continue;
    out.push({
      id: r.id,
      version: r.version,
      source: r.source === "CUSTOMER" ? "CUSTOMER" : "ADMIN",
      createdAt: r.createdAt.toISOString(),
      authorName: r.author?.name ?? r.author?.email ?? null,
      message: r.message,
      total: Number(r.total),
      currency: r.currency,
      lines: snap.lines.map((l) => ({
        id: l.id,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        total: Number(l.total),
        customerStatus: l.customerStatus ?? null,
        customerNote: l.customerNote ?? null,
        proposedQuantity:
          l.proposedQuantity == null ? null : Number(l.proposedQuantity),
        proposedUnitPrice:
          l.proposedUnitPrice == null ? null : Number(l.proposedUnitPrice),
        proposedDescription: l.proposedDescription ?? null,
      })),
    });
  }
  if (live) {
    out.push({
      id: "live",
      version: null,
      source: "LIVE",
      createdAt: null,
      authorName: null,
      message: null,
      total: live.total,
      currency: live.currency,
      lines: live.lines,
    });
  }
  return out;
}
