"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Loader2,
  Check,
  Send,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  acceptCustomerProposal,
  sendAdminCounter,
  updateQuotationLine,
} from "../actions";
import type { LineDiff } from "@/lib/quotations";
import type { ChatMessage } from "@/components/app/quotation-chat-panel";

/**
 * Admin-side negotiation control surface, shown when the quotation is in
 * COUNTERED status. Renders the customer's proposed changes side-by-side with
 * the admin's previous offer and an inline "Your new offer" editor. Admins can:
 *   - Edit the live `QuotationLine` inline (auto-saves on blur via
 *     `updateQuotationLine`). This is what gets emailed back to the customer.
 *   - Click "Accept customer changes" to apply the customer's counters as the
 *     final agreement.
 *   - Click "Send counter" → confirm dialog with optional cover message →
 *     `sendAdminCounter` snapshots a new ADMIN revision and re-emails the
 *     customer.
 */
export function NegotiationPanel({
  quotationId,
  diff,
  currency,
  liveTotal,
  customerTotal,
  lineMessages,
}: {
  quotationId: string;
  diff: LineDiff[];
  currency: string;
  liveTotal: number;
  customerTotal: number;
  /** Map of lineId -> recent chat messages on that line (admin-side preview). */
  lineMessages?: Record<string, ChatMessage[]>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");

  function tx(key: string, fb: string): string {
    return t.has(key) ? t(key) : fb;
  }

  const fmt = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency }),
    [locale, currency],
  );

  // Local draft state for the "Your new offer" column. Initialized from each
  // line's live values; on blur we persist via updateQuotationLine so the row
  // is the new offer that sendAdminCounter will email.
  const initial = React.useMemo(
    () =>
      Object.fromEntries(
        diff.map((d) => [
          d.lineId,
          {
            description: d.description,
            quantity: d.quantity,
            unitPrice: d.unitPrice,
          },
        ]),
      ),
    [diff],
  );
  const [draft, setDraft] = React.useState(initial);
  // Re-sync if the diff prop refreshes (e.g. after a row save).
  React.useEffect(() => setDraft(initial), [initial]);

  function setLine(
    lineId: string,
    patch: Partial<{ description: string; quantity: number; unitPrice: number }>,
  ) {
    setDraft((d) => ({ ...d, [lineId]: { ...d[lineId], ...patch } }));
  }

  async function persistRow(lineId: string) {
    const d = draft[lineId];
    const original = initial[lineId];
    if (!d || !original) return;
    if (
      d.description === original.description &&
      d.quantity === original.quantity &&
      d.unitPrice === original.unitPrice
    ) {
      return;
    }
    setBusy(`save-${lineId}`);
    try {
      await updateQuotationLine(lineId, {
        description: d.description,
        quantity: d.quantity,
        unitPrice: d.unitPrice,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  // Total of what's currently in the "Your new offer" column (draft state),
  // which approximates the new total the customer will see.
  const draftTotal = React.useMemo(
    () =>
      Object.values(draft).reduce(
        (acc, d) => acc + d.quantity * d.unitPrice,
        0,
      ),
    [draft],
  );

  async function onAccept() {
    setBusy("accept");
    try {
      await acceptCustomerProposal(quotationId);
      toast.success(
        tx(
          "quotations.portal.acceptedCustomerToast",
          "Accepted the customer's proposal.",
        ),
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function onConfirmCounter() {
    setBusy("counter");
    try {
      await sendAdminCounter({
        quotationId,
        locale,
        message: message.trim() || undefined,
      });
      toast.success(
        tx("quotations.portal.counterSentToast", "Counter sent to the customer."),
      );
      setDialogOpen(false);
      setMessage("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-amber-300 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          {tx(
            "quotations.portal.customerProposed",
            "Customer proposed changes",
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-hidden rounded-md border bg-background">
          <div className="grid grid-cols-[2fr_2fr_3fr] border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="border-r px-3 py-1.5">
              {tx("quotations.portal.original", "Original")}
            </div>
            <div className="border-r px-3 py-1.5">
              {tx("quotations.portal.customer", "Customer asks")}
            </div>
            <div className="px-3 py-1.5">
              {tx("quotations.portal.yourCounterCol", "Your new offer (auto-saved)")}
            </div>
          </div>
          <ul className="divide-y">
            {diff.map((row) => {
              const d = draft[row.lineId] ?? {
                description: row.description,
                quantity: row.quantity,
                unitPrice: row.unitPrice,
              };
              const proposed = row.proposed;
              const draftLineTotal = d.quantity * d.unitPrice;
              return (
                <li
                  key={row.lineId}
                  className="grid grid-cols-[2fr_2fr_3fr] items-start"
                >
                  {/* Original (admin offered before customer responded) */}
                  <div className="border-r px-3 py-2 text-sm">
                    <div className="font-medium">{row.description}</div>
                    <div className="font-mono text-xs">
                      {row.quantity} × {fmt.format(row.unitPrice)} ={" "}
                      <span className="font-semibold">
                        {fmt.format(row.quantity * row.unitPrice)}
                      </span>
                    </div>
                  </div>

                  {/* Customer's counter (or "accepted as-is") */}
                  <div className="border-r px-3 py-2 text-sm">
                    {row.customerStatus === "MODIFIED" && proposed ? (
                      <>
                        <div className="font-medium">{proposed.description}</div>
                        <div className="font-mono text-xs">
                          {proposed.quantity} × {fmt.format(proposed.unitPrice)} ={" "}
                          <span className="font-semibold">
                            {fmt.format(proposed.total)}
                          </span>
                        </div>
                        {row.changed && (
                          <DeltaBadge
                            value={proposed.total - row.quantity * row.unitPrice}
                            currency={currency}
                            locale={locale}
                          />
                        )}
                        {row.customerNote && (
                          <div className="mt-1 italic text-xs text-amber-900 dark:text-amber-200">
                            “{row.customerNote}”
                          </div>
                        )}
                      </>
                    ) : row.customerStatus === "ACCEPTED" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        <Check className="h-3 w-3" />
                        {tx(
                          "quotations.portal.customerAcceptedHint",
                          "Customer accepted",
                        )}
                      </span>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">
                        {tx("quotations.portal.noResponse", "No response")}
                      </span>
                    )}
                    <ThreadPreview
                      messages={lineMessages?.[row.lineId] ?? []}
                      tx={tx}
                    />
                  </div>

                  {/* Editable "Your new offer" — auto-saves on blur */}
                  <div className="px-3 py-2 space-y-1.5">
                    <Input
                      value={d.description}
                      onChange={(e) =>
                        setLine(row.lineId, { description: e.target.value })
                      }
                      onBlur={() => persistRow(row.lineId)}
                      className="h-8 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={d.quantity}
                        onChange={(e) =>
                          setLine(row.lineId, {
                            quantity: Number(e.target.value),
                          })
                        }
                        onBlur={() => persistRow(row.lineId)}
                        className="h-8 text-right font-mono text-xs"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={d.unitPrice}
                        onChange={(e) =>
                          setLine(row.lineId, {
                            unitPrice: Number(e.target.value),
                          })
                        }
                        onBlur={() => persistRow(row.lineId)}
                        className="h-8 text-right font-mono text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {tx("quotations.lines.lineTotal", "Total")}:
                      </span>
                      <span className="font-mono font-semibold">
                        {fmt.format(draftLineTotal)}
                      </span>
                    </div>
                    {busy === `save-${row.lineId}` && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {tx("common.saving", "Saving…")}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Totals comparison strip */}
        <div className="grid grid-cols-3 gap-2 rounded-md border bg-background px-3 py-2 text-xs">
          <TotalCell
            label={tx("quotations.portal.original", "Original")}
            value={diff.reduce((a, r) => a + r.quantity * r.unitPrice, 0)}
            currency={currency}
            locale={locale}
          />
          <TotalCell
            label={tx("quotations.portal.customerTotal", "Customer asks")}
            value={customerTotal}
            currency={currency}
            locale={locale}
          />
          <TotalCell
            label={tx("quotations.portal.yourTotal", "Your new offer")}
            value={draftTotal || liveTotal}
            currency={currency}
            locale={locale}
            highlight
          />
        </div>

        <p className="text-[11px] text-muted-foreground">
          {tx(
            "quotations.portal.sendCounterHint",
            "Edit the right-hand column above. Changes auto-save. Click Send counter when ready to email the customer.",
          )}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={onAccept}
            disabled={busy !== null}
            className="gap-2"
          >
            {busy === "accept" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {tx(
              "quotations.portal.acceptCustomer",
              "Accept customer changes",
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialogOpen(true)}
            disabled={busy !== null}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {tx("quotations.portal.sendCounter", "Send counter")}
          </Button>
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent withDescription>
          <DialogHeader>
            <DialogTitle>
              {tx(
                "quotations.portal.confirmCounterTitle",
                "Send corrected quotation",
              )}
            </DialogTitle>
            <DialogDescription>
              {tx(
                "quotations.portal.confirmCounterBody",
                "An email with the new totals will be sent to the customer. They'll be able to accept or counter again from the portal.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {tx("quotations.portal.customerTotal", "Customer asks")}
                </div>
                <div className="font-mono font-semibold">
                  {fmt.format(customerTotal)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {tx("quotations.portal.yourTotal", "Your new offer")}
                </div>
                <div className="font-mono font-semibold">
                  {fmt.format(draftTotal || liveTotal)}
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">
                {tx(
                  "quotations.portal.confirmCounterMessage",
                  "Optional message to customer",
                )}
              </Label>
              <Textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={tx(
                  "quotations.portal.confirmCounterPlaceholder",
                  "Explain what you changed and why…",
                )}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={busy === "counter"}
            >
              {tx("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              onClick={onConfirmCounter}
              disabled={busy === "counter"}
              className="gap-2"
            >
              {busy === "counter" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {tx("quotations.portal.sendCounter", "Send counter")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TotalCell({
  label,
  value,
  currency,
  locale,
  highlight,
}: {
  label: string;
  value: number;
  currency: string;
  locale: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md px-2 py-1 ${
        highlight ? "bg-amber-100 dark:bg-amber-900/40" : ""
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold">
        {new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
        }).format(value)}
      </div>
    </div>
  );
}

function ThreadPreview({
  messages,
  tx,
}: {
  messages: ChatMessage[];
  tx: (key: string, fb: string) => string;
}) {
  if (messages.length === 0) return null;
  const recent = messages.slice(-2);
  const more = messages.length - recent.length;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <MessageSquare className="h-3 w-3" />
        {tx("quotations.portal.threadPreview", "Recent comments")}
        {more > 0 && (
          <span className="text-muted-foreground/80">
            (+{more} {tx("common.more", "more")})
          </span>
        )}
      </div>
      {recent.map((m) => (
        <div
          key={m.id}
          className={`rounded border px-1.5 py-1 text-[11px] ${
            m.authorRole === "CUSTOMER"
              ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
              : "border-primary/30 bg-primary/5"
          }`}
        >
          <span className="font-medium">
            {m.authorName ??
              (m.authorRole === "CUSTOMER"
                ? tx("quotations.portal.sourceCustomer", "Customer")
                : tx("quotations.portal.sourceAdmin", "You"))}
            :
          </span>{" "}
          <span className="break-words">{m.body}</span>
        </div>
      ))}
    </div>
  );
}

function DeltaBadge({
  value,
  currency,
  locale,
}: {
  value: number;
  currency: string;
  locale: string;
}) {
  if (value === 0) return null;
  const positive = value > 0;
  const cls = positive
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
    : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200";
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      <Icon className="h-3 w-3" />
      {positive ? "+" : "−"}
      {new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
      }).format(Math.abs(value))}
    </span>
  );
}
