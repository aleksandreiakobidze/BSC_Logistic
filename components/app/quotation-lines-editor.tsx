"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addQuotationLine,
  updateQuotationLine,
  deleteQuotationLine,
} from "@/app/[locale]/(dashboard)/quotations/actions";

export interface QuotationLineRow {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
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
  const [draft, setDraft] = React.useState({
    description: "",
    quantity: 1,
    unitPrice: 0,
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
      });
      setDraft({ description: "", quantity: 1, unitPrice: 0 });
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
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
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
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <form
          onSubmit={addLine}
          className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[1fr_100px_140px_auto]"
        >
          <Input
            placeholder={t("quotations.lines.description")}
            value={draft.description}
            onChange={(e) =>
              setDraft((d) => ({ ...d, description: e.target.value }))
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
}: {
  line: QuotationLineRow;
  fmt: (n: number) => string;
  readOnly: boolean;
  onSave: (l: QuotationLineRow) => void;
  onRemove: () => void;
}) {
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

  const liveTotal = editing.quantity * editing.unitPrice;

  if (readOnly) {
    return (
      <tr>
        <td className="px-3 py-2">{line.description}</td>
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
