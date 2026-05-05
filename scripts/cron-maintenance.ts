/**
 * Periodic maintenance tasks. Run as the `bsc-cron` ACA Scheduled Job
 * (every 15 minutes in production) so the per-request cost of expiring
 * quotations and refreshing overdue invoices is borne by a background job
 * instead of the next page load.
 *
 * Iterates every Organization once. Failures in one org never abort the
 * others — each org's outcome is logged and the script exits 0 so the Job
 * isn't retried unnecessarily. Hard crashes (DB unreachable, etc.) propagate
 * to a non-zero exit so Azure Monitor surfaces them.
 *
 * Usage:
 *   node node_modules/tsx/dist/cli.mjs scripts/cron-maintenance.ts
 *   # or, locally
 *   npx tsx scripts/cron-maintenance.ts
 */

import { prisma } from "@/lib/db";
import { expireQuotations } from "@/lib/quotations";
import { refreshOverdueInvoices } from "@/lib/payments";

type OrgResult = {
  orgId: string;
  orgName: string;
  expiredQuotations: number | null;
  refreshedInvoices: number | null;
  error?: string;
};

async function main() {
  const startedAt = Date.now();
  console.log(`[cron-maintenance] starting at ${new Date().toISOString()}`);

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  console.log(`[cron-maintenance] processing ${orgs.length} org(s)`);

  const results: OrgResult[] = [];
  for (const org of orgs) {
    const result: OrgResult = {
      orgId: org.id,
      orgName: org.name,
      expiredQuotations: null,
      refreshedInvoices: null,
    };
    try {
      result.expiredQuotations = await expireQuotations(org.id);
    } catch (err) {
      result.error = `expireQuotations: ${(err as Error).message}`;
      console.error(`[cron-maintenance] ${org.id} expireQuotations failed`, err);
    }
    try {
      result.refreshedInvoices = await refreshOverdueInvoices(org.id);
    } catch (err) {
      const msg = `refreshOverdueInvoices: ${(err as Error).message}`;
      result.error = result.error ? `${result.error}; ${msg}` : msg;
      console.error(
        `[cron-maintenance] ${org.id} refreshOverdueInvoices failed`,
        err,
      );
    }
    results.push(result);
  }

  const summary = {
    durationMs: Date.now() - startedAt,
    orgs: results.length,
    expiredQuotations: results.reduce(
      (acc, r) => acc + (r.expiredQuotations ?? 0),
      0,
    ),
    refreshedInvoices: results.reduce(
      (acc, r) => acc + (r.refreshedInvoices ?? 0),
      0,
    ),
    errors: results.filter((r) => r.error).length,
  };
  console.log("[cron-maintenance] summary", JSON.stringify(summary));
}

main()
  .catch((err) => {
    console.error("[cron-maintenance] fatal", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
