"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  StockItemPicker,
  type PickedStockItem,
} from "@/components/app/stock-item-picker";
import {
  addQuotationLine,
  updateQuotationLine,
  deleteQuotationLine,
} from "@/app/[locale]/(dashboard)/quotations/actions";
import { QuotationLineThread } from "@/components/app/quotation-line-thread";
import type { ChatMessage } from "@/components/app/quotation-chat-panel";

export interface QuotationLineRow {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  itemId?: string | null;
  /** Customer-side negotiation columns. Populated only on the admin page. */
  customerStatus?: string | null;
  customerNote?: string | null;
  proposedDescription?: string | null;
  proposedQuantity?: number | null;
  proposedUnitPrice?: number | null;
  /** Per-line chat thread messages. Populated only on the admin page. */
  messages?: ChatMessage[];
}

export function QuotationLinesEditor({
  quotationId,
  lines,
  currency,
  locale,
  readOnly,
}: {
  quotationId: string;
  lines: QuotationLineRow[];
  currency: string;
  locale: string;
  readOnly?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState<{
    description: string;
    quantity: number;
    unitPrice: number;
    itemId: string | null;
  }>({
    description: "",
    quantity: 1,
    unitPrice: 0,
    itemId: null,
  });

  const fmt = React.useCallback(
    (n: number) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
      }).format(n),
    [locale, currency],
  );

  async function addLine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.description.trim()) {
      toast.error(t("quotations.lines.descriptionRequired"));
      return;
    }
    setBusy(true);
    try {
      await addQuotationLine(quotationId, {
        description: draft.description,
        quantity: draft.quantity,
        unitPrice: draft.unitPrice,
        itemId: draft.itemId,
      });
      setDraft({ description: "", quantity: 1, unitPrice: 0, itemId: null });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function persistRow(line: QuotationLineRow) {
    setBusy(true);
    try {
      await updateQuotationLine(line.id, {
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        itemId: line.itemId ?? null,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  function applyPickedItem(picked: PickedStockItem) {
    setDraft({
      description: picked.description?.trim()
        ? `${picked.name} — ${picked.description}`
        : picked.name,
      quantity: 1,
      unitPrice: picked.unitPrice,
      itemId: picked.id,
    });
    // Currency mismatch hint: lines inherit the quotation's currency, so when
    // the picked item is priced in another currency we leave the numeric value
    // intact (no FX conversion in scope) but warn the user to adjust manually.
    if (picked.currency && picked.currency !== currency) {
      toast.warning(
        t.has("quotations.lines.currencyMismatch")
          ? t("quotations.lines.currencyMismatch", {
              itemCurrency: picked.currency,
              quotationCurrency: currency,
            })
          : `Item priced in ${picked.currency}, quotation is in ${currency}. Adjust price if needed.`,
      );
    }
  }

  async function removeRow(id: string) {
    setBusy(true);
    try {
      await deleteQuotationLine(id);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">
                {t("quotations.lines.description")}
              </th>
              <th className="px-3 py-2 text-right w-24">
                {t("quotations.lines.quantity")}
              </th>
              <th className="px-3 py-2 text-right w-32">
                {t("quotations.lines.unitPrice")}
              </th>
              <th className="px-3 py-2 text-right w-32">
                {t("quotations.lines.lineTotal")}
              </th>
              {!readOnly && <th className="w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={readOnly ? 4 : 5}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {t("quotations.lines.empty")}
                </td>
              </tr>
            ) : (
              lines.map((l) => (
                <LineRow
                  key={l.id}
                  line={l}
                  fmt={fmt}
                  readOnly={!!readOnly || busy}
                  onSave={persistRow}
                  onRemove={() => removeRow(l.id)}
                  quotationId={quotationId}
                  locale={locale}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <form
          onSubmit={addLine}
          className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[180px_1fr_100px_140px_auto]"
        >
          <StockItemPicker onPick={applyPickedItem} disabled={busy} />
          <Input
            placeholder={t("quotations.lines.description")}
            value={draft.description}
            onChange={(e) =>
              setDraft((d) => ({ ...d, description: e.target.value, itemId: null }))
            }
          />
          <Input
            type="number"
            step="0.01"
            min={0}
            value={draft.quantity}
            onChange={(e) =>
              setDraft((d) => ({ ...d, quantity: Number(e.target.value) }))
            }
          />
          <Input
            type="number"
            step="0.01"
            min={0}
            value={draft.unitPrice}
            onChange={(e) =>
              setDraft((d) => ({ ...d, unitPrice: Number(e.target.value) }))
            }
          />
          <Button type="submit" disabled={busy} className="gap-1.5">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {t("quotations.lines.addLine")}
          </Button>
        </form>
      )}
    </div>
  );
}

function LineRow({
  line,
  fmt,
  readOnly,
  onSave,
  onRemove,
  quotationId,
  locale,
}: {
  line: QuotationLineRow;
  fmt: (n: number) => string;
  readOnly: boolean;
  onSave: (l: QuotationLineRow) => void;
  onRemove: () => void;
  quotationId: string;
  locale: string;
}) {
  const t = useTranslations();
  const [editing, setEditing] = React.useState({
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  });
  const dirty =
    editing.description !== line.description ||
    editing.quantity !== line.quantity ||
    editing.unitPrice !== line.unitPrice;

  function commit() {
    if (!dirty) return;
    onSave({ ...line, ...editing });
  }

  function tx(key: string, fb: string): string {
    return t.has(key) ? t(key) : fb;
  }

  const liveTotal = editing.quantity * editing.unitPrice;
  const hasCustomerCounter = line.customerStatus === "MODIFIED";
  const hasCustomerAccept = line.customerStatus === "ACCEPTED";
  const thread = (
    <QuotationLineThread
      quotationId={quotationId}
      lineId={line.id}
      messages={line.messages ?? []}
      viewerRole="ADMIN"
      locale={locale}
      legacyCustomerNote={line.customerNote}
    />
  );

  if (readOnly) {
    return (
      <tr>
        <td className="px-3 py-2">
          <div>{line.description}</div>
          <CustomerHint
            line={line}
            fmt={fmt}
            hasCounter={hasCustomerCounter}
            hasAccept={hasCustomerAccept}
            tx={tx}
          />
          {thread}
        </td>
        <td className="px-3 py-2 text-right font-mono">{line.quantity}</td>
        <td className="px-3 py-2 text-right font-mono">{fmt(line.unitPrice)}</td>
        <td className="px-3 py-2 text-right font-mono">{fmt(line.total)}</td>
      </tr>
    );
  }

  return (
    <tr className="align-middle">
      <td className="px-2 py-1">
        <Input
          value={editing.description}
          onChange={(e) =>
            setEditing((s) => ({ ...s, description: e.target.value }))
          }
          onBlur={commit}
          className="h-8"
        />
        <CustomerHint
          line={line}
          fmt={fmt}
          hasCounter={hasCustomerCounter}
          hasAccept={hasCustomerAccept}
          tx={tx}
        />
        {thread}
      </td>
      <td className="px-2 py-1 text-right">
        <Input
          type="number"
          step="0.01"
          min={0}
          value={editing.quantity}
          onChange={(e) =>
            setEditing((s) => ({ ...s, quantity: Number(e.target.value) }))
          }
          onBlur={commit}
          className="h-8 text-right"
        />
      </td>
      <td className="px-2 py-1 text-right">
        <Input
          type="number"
          step="0.01"
          min={0}
          value={editing.unitPrice}
          onChange={(e) =>
            setEditing((s) => ({ ...s, unitPrice: Number(e.target.value) }))
          }
          onBlur={commit}
          className="h-8 text-right"
        />
      </td>
      <td className="px-3 py-2 text-right font-mono">{fmt(liveTotal)}</td>
      <td className="px-2 py-1 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

function CustomerHint({
  line,
  fmt,
  hasCounter,
  hasAccept,
  tx,
}: {
  line: QuotationLineRow;
  fmt: (n: number) => string;
  hasCounter: boolean;
  hasAccept: boolean;
  tx: (key: string, fb: string) => string;
}) {
  if (hasCounter) {
    const q = line.proposedQuantity ?? line.quantity;
    const p = line.proposedUnitPrice ?? line.unitPrice;
    const desc = line.proposedDescription ?? line.description;
    return (
      <div className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex items-center gap-1 font-medium">
          <MessageSquareWarning className="h-3 w-3" />
          {tx("quotations.portal.customerAskedHint", "Customer asked")}:
        </div>
        <div className="mt-0.5 font-mono">
          {desc} · {q} × {fmt(p)} = {fmt(q * p)}
        </div>
      </div>
    );
  }
  if (hasAccept) {
    return (
      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
        {tx("quotations.portal.customerAcceptedHint", "Customer accepted")}
      </div>
    );
  }
  return null;
}
