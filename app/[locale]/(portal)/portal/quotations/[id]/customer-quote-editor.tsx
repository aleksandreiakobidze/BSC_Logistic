"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Check,
  Pencil,
  Loader2,
  Send,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitCustomerProposal } from "@/app/[locale]/(dashboard)/quotations/actions";
import { QuotationLineThread } from "@/components/app/quotation-line-thread";
import type { ChatMessage } from "@/components/app/quotation-chat-panel";

export type CustomerEditorLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  customerStatus: "ACCEPTED" | "MODIFIED" | null;
  customerNote: string | null;
  proposedDescription: string | null;
  proposedQuantity: number | null;
  proposedUnitPrice: number | null;
  messages?: ChatMessage[];
};

type DraftLine = {
  /** null = customer hasn't picked yet (PENDING). */
  status: "ACCEPTED" | "MODIFIED" | null;
  description: string;
  quantity: number;
  unitPrice: number;
};

/**
 * Customer-facing per-line negotiation form. Every line starts as PENDING — the
 * customer must explicitly pick Accept or Modify before they can submit. This
 * forces an intentional click and prevents the "I toggled some buttons but
 * nothing saved" confusion. A sticky bar at the top reminds the customer to
 * submit any pending changes.
 *
 * In read-only mode (status is no longer SENT) we render `ReadonlyTable` which
 * shows the original line numbers alongside the customer's submitted counter.
 */
export function CustomerQuoteEditor({
  quotationId,
  lines,
  currency,
  locale,
  editable,
  status,
  submittedAt,
}: {
  quotationId: string;
  lines: CustomerEditorLine[];
  currency: string;
  locale: string;
  editable: boolean;
  status: string;
  submittedAt?: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [drafts, setDrafts] = React.useState<Record<string, DraftLine>>(() =>
    Object.fromEntries(
      lines.map((l) => [
        l.id,
        {
          status: (l.customerStatus ?? null) as DraftLine["status"],
          description: l.proposedDescription ?? l.description,
          quantity: l.proposedQuantity ?? l.quantity,
          unitPrice: l.proposedUnitPrice ?? l.unitPrice,
        },
      ]),
    ),
  );

  const fmt = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency }),
    [locale, currency],
  );

  function tx(key: string, fb: string): string {
    return t.has(key) ? t(key) : fb;
  }

  function setLine(id: string, patch: Partial<DraftLine>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  // ── derived state ────────────────────────────────────────────────────────
  const draftValues = Object.values(drafts);
  const pendingCount = draftValues.filter((d) => d.status === null).length;
  const acceptedCount = draftValues.filter((d) => d.status === "ACCEPTED").length;
  const modifiedCount = draftValues.filter((d) => d.status === "MODIFIED").length;
  const allDecided = pendingCount === 0 && draftValues.length > 0;
  const anyModified = modifiedCount > 0;

  async function onSubmit() {
    if (!allDecided) {
      toast.error(
        tx(
          "quotations.portal.pickEachLine",
          "Please pick Accept or Modify on every line first.",
        ),
      );
      return;
    }
    setBusy(true);
    try {
      const payload = lines.map((l) => {
        const draft = drafts[l.id];
        return draft.status === "ACCEPTED"
          ? {
              lineId: l.id,
              status: "ACCEPTED" as const,
            }
          : {
              lineId: l.id,
              status: "MODIFIED" as const,
              description: draft.description,
              quantity: draft.quantity,
              unitPrice: draft.unitPrice,
            };
      });
      const res = await submitCustomerProposal({
        quotationId,
        lines: payload,
      });
      toast.success(
        res.status === "ACCEPTED"
          ? tx(
              "quotations.portal.acceptedToast",
              "Thanks! The quotation was accepted.",
            )
          : tx(
              "quotations.portal.counteredToast",
              "Your changes were sent to the vendor.",
            ),
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (!editable) {
    const dateFmt = submittedAt
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(submittedAt))
      : null;
    return (
      <div className="space-y-4">
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            status === "ACCEPTED"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200"
              : status === "COUNTERED"
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200"
                : "bg-muted/30 text-muted-foreground"
          }`}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">
              {status === "ACCEPTED"
                ? tx(
                    "quotations.portal.alreadyAccepted",
                    "This quotation has been accepted.",
                  )
                : status === "COUNTERED"
                  ? tx(
                      "quotations.portal.waitingVendor",
                      "Waiting for the vendor's response to your changes.",
                    )
                  : tx(
                      "quotations.portal.notEditable",
                      "This quotation isn't open for changes.",
                    )}
            </div>
            {dateFmt && (
              <div className="text-xs opacity-80">
                {tx("quotations.portal.submittedOn", "Submitted on")} {dateFmt}
              </div>
            )}
          </div>
        </div>
        <ReadonlyTable
          lines={lines}
          fmt={(n) => fmt.format(n)}
          t={t}
          quotationId={quotationId}
          locale={locale}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sticky "you have pending decisions" bar */}
      <div className="sticky top-0 z-20 -mx-4 -mt-2 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            {pendingCount > 0 ? (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="font-medium">
                  {tx(
                    "quotations.portal.unsavedChangesBar",
                    "You haven't responded to every line yet.",
                  )}
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                  {pendingCount}{" "}
                  {tx("quotations.portal.pendingShort", "pending")}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="font-medium">
                  {anyModified
                    ? tx(
                        "quotations.portal.readyToCounter",
                        "Ready to send your counter back to the vendor.",
                      )
                    : tx(
                        "quotations.portal.readyToAccept",
                        "Ready to accept the entire quotation.",
                      )}
                </span>
                <span className="text-xs text-muted-foreground">
                  · {acceptedCount}{" "}
                  {tx("quotations.portal.acceptedShort", "accepted")}
                  {modifiedCount > 0 && (
                    <>
                      {" "}
                      · {modifiedCount}{" "}
                      {tx("quotations.portal.modifiedShort", "modified")}
                    </>
                  )}
                </span>
              </>
            )}
          </div>
          <Button
            onClick={onSubmit}
            disabled={busy || !allDecided}
            size="sm"
            className="gap-2"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {tx("quotations.portal.submit", "Submit response")}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {tx(
          "quotations.portal.editorHint",
          "Pick Accept or Modify for every line. Your changes are not sent until you click Submit response.",
        )}
      </p>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">
                {tx("quotations.lines.description", "Description")}
              </th>
              <th className="px-3 py-2 text-right w-20">
                {tx("quotations.lines.quantity", "Qty")}
              </th>
              <th className="px-3 py-2 text-right w-28">
                {tx("quotations.lines.unitPrice", "Unit price")}
              </th>
              <th className="px-3 py-2 text-right w-28">
                {tx("quotations.lines.lineTotal", "Total")}
              </th>
              <th className="px-3 py-2 text-right w-40">
                {tx("quotations.portal.action", "Action")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((l) => {
              const d = drafts[l.id];
              const liveTotal =
                d.status === "MODIFIED" ? d.quantity * d.unitPrice : l.total;
              const rowBg =
                d.status === "ACCEPTED"
                  ? "bg-emerald-50/60 dark:bg-emerald-950/10"
                  : d.status === "MODIFIED"
                    ? "bg-amber-50/60 dark:bg-amber-950/10"
                    : "bg-rose-50/30 dark:bg-rose-950/10";
              return (
                <React.Fragment key={l.id}>
                  <tr className={`align-top ${rowBg}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{l.description}</div>
                      {d.status === "MODIFIED" && (
                        <Input
                          className="mt-2 h-8"
                          value={d.description}
                          onChange={(e) =>
                            setLine(l.id, { description: e.target.value })
                          }
                          placeholder={tx(
                            "quotations.portal.descPlaceholder",
                            "Describe your change…",
                          )}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {d.status === "MODIFIED" ? (
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={d.quantity}
                          onChange={(e) =>
                            setLine(l.id, {
                              quantity: Number(e.target.value),
                            })
                          }
                          className="h-8 text-right font-mono"
                        />
                      ) : (
                        <span className="font-mono">{l.quantity}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {d.status === "MODIFIED" ? (
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={d.unitPrice}
                          onChange={(e) =>
                            setLine(l.id, {
                              unitPrice: Number(e.target.value),
                            })
                          }
                          className="h-8 text-right font-mono"
                        />
                      ) : (
                        <span className="font-mono">{fmt.format(l.unitPrice)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {fmt.format(liveTotal)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex overflow-hidden rounded-md border">
                        <button
                          type="button"
                          onClick={() =>
                            setLine(l.id, { status: "ACCEPTED" })
                          }
                          className={`px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors ${
                            d.status === "ACCEPTED"
                              ? "bg-emerald-600 text-white"
                              : "hover:bg-muted"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                          {tx("quotations.portal.accept", "Accept")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setLine(l.id, { status: "MODIFIED" })
                          }
                          className={`px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors ${
                            d.status === "MODIFIED"
                              ? "bg-amber-600 text-white"
                              : "hover:bg-muted"
                          }`}
                        >
                          <Pencil className="h-3 w-3" />
                          {tx("quotations.portal.modify", "Modify")}
                        </button>
                      </div>
                      {d.status === null && (
                        <div className="mt-1 text-[11px] text-rose-600">
                          {tx(
                            "quotations.portal.pickRequired",
                            "Please choose",
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  <tr className={rowBg}>
                    <td colSpan={5} className="px-3 pb-2">
                      <QuotationLineThread
                        quotationId={quotationId}
                        lineId={l.id}
                        messages={l.messages ?? []}
                        viewerRole="CUSTOMER"
                        locale={locale}
                        legacyCustomerNote={l.customerNote}
                      />
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}

function ReadonlyTable({
  lines,
  fmt,
  t,
  quotationId,
  locale,
}: {
  lines: CustomerEditorLine[];
  fmt: (n: number) => string;
  t: ReturnType<typeof useTranslations>;
  quotationId: string;
  locale: string;
}) {
  function tx(key: string, fb: string): string {
    return t.has(key) ? t(key) : fb;
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">
              {tx("quotations.lines.description", "Description")}
            </th>
            <th className="px-3 py-2 text-right w-20">
              {tx("quotations.lines.quantity", "Qty")}
            </th>
            <th className="px-3 py-2 text-right w-28">
              {tx("quotations.lines.unitPrice", "Unit price")}
            </th>
            <th className="px-3 py-2 text-right w-28">
              {tx("quotations.lines.lineTotal", "Total")}
            </th>
            <th className="px-3 py-2 text-right w-28">
              {tx("quotations.portal.yourResponse", "Your response")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lines.map((l) => {
            const isAccepted = l.customerStatus === "ACCEPTED";
            const isModified = l.customerStatus === "MODIFIED";
            const rowBg = isAccepted
              ? "bg-emerald-50/60 dark:bg-emerald-950/10"
              : isModified
                ? "bg-amber-50/60 dark:bg-amber-950/10"
                : "";
            return (
              <React.Fragment key={l.id}>
                <tr className={`align-top ${rowBg}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.description}</div>
                    {isModified && (
                      <div className="mt-1 rounded-md border border-amber-300 bg-background/60 px-2 py-1 text-xs">
                        <span className="font-semibold">
                          {tx("quotations.portal.yourCounter", "Your counter")}:
                        </span>{" "}
                        {l.proposedDescription ?? l.description} ·{" "}
                        {l.proposedQuantity ?? l.quantity} ×{" "}
                        {fmt(l.proposedUnitPrice ?? l.unitPrice)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {l.quantity}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {fmt(l.unitPrice)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {fmt(l.total)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isAccepted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        <Check className="h-3 w-3" />
                        {tx("quotations.portal.acceptedShort", "accepted")}
                      </span>
                    ) : isModified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        <Pencil className="h-3 w-3" />
                        {tx("quotations.portal.modifiedShort", "modified")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
                <tr className={rowBg}>
                  <td colSpan={5} className="px-3 pb-2">
                    <QuotationLineThread
                      quotationId={quotationId}
                      lineId={l.id}
                      messages={l.messages ?? []}
                      viewerRole="CUSTOMER"
                      locale={locale}
                      legacyCustomerNote={l.customerNote}
                    />
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
