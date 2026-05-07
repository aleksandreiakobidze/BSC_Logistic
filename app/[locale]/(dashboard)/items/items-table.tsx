"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Trash2, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ItemDialog } from "./item-dialog";
import { deleteItem } from "./actions";
import { formatCurrency, formatDate } from "@/lib/utils";

export type ItemRow = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  unitPrice: number;
  currency: string;
  taxRate: number;
  weightKg: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export function ItemsTable({
  rows,
  locale,
}: {
  rows: ItemRow[];
  locale: string;
}) {
  const t = useTranslations();
  const tx = (k: string, fb: string) => (t.has(k) ? t(k) : fb);
  const router = useRouter();
  const [editing, setEditing] = React.useState<ItemRow | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  async function onDelete(id: string) {
    if (
      !confirm(
        tx(
          "items.confirmDelete",
          "Delete this item? This cannot be undone.",
        ),
      )
    ) {
      return;
    }
    setDeleting(id);
    try {
      const res = await deleteItem(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(tx("items.deleted", "Item deleted"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">{t("warehouse.sku")}</TableHead>
            <TableHead>{t("common.name")}</TableHead>
            <TableHead className="hidden lg:table-cell">
              {tx("items.fields.description", "Description")}
            </TableHead>
            <TableHead className="text-right w-[140px]">
              {tx("items.fields.unitPrice", "Unit price")}
            </TableHead>
            <TableHead className="hidden md:table-cell text-center w-[80px]">
              {tx("items.fields.unit", "Unit")}
            </TableHead>
            <TableHead className="hidden md:table-cell text-right w-[80px]">
              {tx("items.fields.tax", "Tax")}
            </TableHead>
            <TableHead className="hidden xl:table-cell w-[120px]">
              {t("common.created")}
            </TableHead>
            <TableHead className="hidden 2xl:table-cell w-[120px]">
              {t.has("common.updated") ? t("common.updated") : "Updated"}
            </TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.id}
              className="group hover:bg-muted/40 transition-colors"
            >
              <TableCell>
                <Link
                  href={`/items/${r.id}`}
                  className="font-mono text-xs uppercase text-primary hover:underline"
                >
                  {r.sku}
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  href={`/items/${r.id}`}
                  className="font-medium hover:underline"
                >
                  {r.name}
                </Link>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground text-sm max-w-[320px] truncate">
                {r.description || "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCurrency(r.unitPrice, r.currency, locale)}
              </TableCell>
              <TableCell className="hidden md:table-cell text-center">
                <Badge variant="muted" className="font-mono text-[10px]">
                  {r.unit}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-right text-xs text-muted-foreground">
                {r.taxRate > 0 ? `${r.taxRate}%` : "—"}
              </TableCell>
              <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                {formatDate(r.createdAt, locale)}
              </TableCell>
              <TableCell className="hidden 2xl:table-cell text-xs text-muted-foreground">
                {formatDate(r.updatedAt, locale)}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md opacity-60 hover:opacity-100 hover:bg-muted"
                      aria-label="Actions"
                    >
                      {deleting === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setEditing(r);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      {t.has("common.edit") ? t("common.edit") : "Edit"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={(e) => {
                        e.preventDefault();
                        onDelete(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("common.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editing && (
        <ItemDialog
          value={editing}
          open={Boolean(editing)}
          onOpenChange={(o) => {
            if (!o) setEditing(null);
          }}
          trigger={null}
        />
      )}
    </>
  );
}
