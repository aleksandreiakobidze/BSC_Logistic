"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  Loader2,
  Package,
  ChevronsUpDown,
  Plus,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  searchItems,
  getItemsByIds,
} from "@/app/[locale]/(dashboard)/items/actions";
import {
  ItemDialog,
} from "@/app/[locale]/(dashboard)/items/item-dialog";

export type PickedStockItem = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  unitPrice: number;
  currency: string;
  taxRate: number;
};

const RECENT_STORAGE_KEY = "bsc:item-picker:recent";
const RECENT_LIMIT = 5;

function readRecentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function pushRecentId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = readRecentIds().filter((x) => x !== id);
    const next = [id, ...existing].slice(0, RECENT_LIMIT);
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/**
 * Quotation-line item picker.
 *
 * Designed for the in-grid "add line" form, so the trigger is a compact
 * outline button. Opens a wide popover with three regions:
 *   1. Search row (debounced 250 ms)
 *   2. Recently-used chips (only when query is empty) — ids cached in
 *      localStorage so the same items resurface across quotations.
 *   3. Result list — product cards (SKU badge, name, description, price + tax)
 *
 * Footer hosts a "+ Create new item" button that opens the same ItemDialog
 * used on the /items page; on success the new item is auto-picked and the
 * picker closes.
 */
export function StockItemPicker({
  onPick,
  disabled,
  triggerLabel,
}: {
  onPick: (item: PickedStockItem) => void;
  disabled?: boolean;
  triggerLabel?: string;
}) {
  const t = useTranslations();
  const tx = (k: string, fb: string) => (t.has(k) ? t(k) : fb);

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<PickedStockItem[]>([]);
  const [recent, setRecent] = React.useState<PickedStockItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const hasLoadedRecent = React.useRef(false);

  const placeholder = triggerLabel ?? tx("items.pickItem", "Pick item or type SKU…");

  // Debounced search whenever query changes (or popover opens).
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const rows = await searchItems(query);
        if (cancelled) return;
        setItems(rows);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, query]);

  // Hydrate recently-used items once per session when the popover first opens.
  React.useEffect(() => {
    if (!open || hasLoadedRecent.current) return;
    hasLoadedRecent.current = true;
    const ids = readRecentIds();
    if (ids.length === 0) {
      setRecent([]);
      return;
    }
    (async () => {
      try {
        const fetched = await getItemsByIds(ids);
        // Preserve the original recency ordering.
        const map = new Map(fetched.map((i) => [i.id, i]));
        setRecent(ids.map((id) => map.get(id)).filter(Boolean) as PickedStockItem[]);
      } catch {
        setRecent([]);
      }
    })();
  }, [open]);

  // Autofocus the search input on open.
  React.useEffect(() => {
    if (open) {
      const handle = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(handle);
    }
  }, [open]);

  function handlePick(item: PickedStockItem) {
    pushRecentId(item.id);
    setRecent((r) => {
      const filtered = r.filter((x) => x.id !== item.id);
      return [item, ...filtered].slice(0, RECENT_LIMIT);
    });
    onPick(item);
    setOpen(false);
    setQuery("");
  }

  // Close the picker popover before opening the create dialog so the two
  // overlays don't compete for pointer events (Radix Popover's outside-click
  // handler can otherwise eat the dialog's first interaction).
  function openCreateDialog() {
    setOpen(false);
    setCreateDialogOpen(true);
  }

  const showRecent = query.trim().length === 0 && recent.length > 0;
  const hasResults = items.length > 0;
  const showEmpty = !loading && !hasResults && query.trim().length > 0;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal h-8 px-2 text-xs"
          >
            <span className="flex items-center gap-1.5 truncate text-left">
              <Package className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="truncate text-muted-foreground">{placeholder}</span>
            </span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[460px] max-w-[calc(100vw-2rem)] p-0"
        >
          {/* Search row */}
          <div className="flex items-center border-b px-3">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin opacity-60" />
            ) : (
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-60" />
            )}
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tx("items.searchPlaceholder", "Search SKU or name…")}
              className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="ml-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Recently used (only when not actively searching) */}
          {showRecent && (
            <div className="border-b px-3 py-2">
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {tx("items.recentlyUsed", "Recently used")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => handlePick(it)}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs hover:bg-primary/10 hover:border-primary/40"
                    title={`${it.sku} — ${it.name}`}
                  >
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      {it.sku}
                    </span>
                    <span className="truncate max-w-[140px]">{it.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results list */}
          <div className="max-h-[320px] overflow-y-auto p-1">
            {loading && items.length === 0 ? (
              <SkeletonList />
            ) : showEmpty ? (
              <div className="space-y-3 px-3 py-6 text-center">
                <div className="text-sm text-muted-foreground">
                  {tx("items.noResults", "No items found.")}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={openCreateDialog}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {tx("items.createNewWith", 'Create new item with SKU "{query}"').replace(
                    "{query}",
                    query.trim(),
                  )}
                </Button>
              </div>
            ) : !hasResults ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {tx(
                  "items.emptyDesc",
                  "Create your first item to start using it in quotations and invoices.",
                )}
              </div>
            ) : (
              items.map((it) => <ResultRow key={it.id} item={it} onPick={handlePick} />)
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs"
              onClick={openCreateDialog}
            >
              <Plus className="h-3.5 w-3.5" />
              {tx("items.createNew", "Create new item")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Inline create dialog. Picks the freshly-created item and closes. */}
      <ItemDialog
        trigger={null}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaults={query.trim() ? { sku: query.trim() } : undefined}
        onCreated={(item) => {
          handlePick({
            id: item.id,
            sku: item.sku,
            name: item.name,
            description: item.description,
            unit: item.unit,
            unitPrice: item.unitPrice,
            currency: item.currency,
            taxRate: item.taxRate,
          });
        }}
      />
    </>
  );
}

function ResultRow({
  item,
  onPick,
}: {
  item: PickedStockItem;
  onPick: (item: PickedStockItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(item)}
      className={cn(
        "group flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
        "hover:bg-primary/5 focus:bg-primary/5 focus:outline-none",
      )}
    >
      <Badge
        variant="muted"
        className="mt-0.5 shrink-0 font-mono text-[10px] uppercase"
      >
        {item.sku}
      </Badge>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.name}</div>
        {item.description && (
          <div className="line-clamp-1 text-xs text-muted-foreground">
            {item.description}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-sm">
          {item.currency} {item.unitPrice.toFixed(2)}
        </div>
        <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          <span>/ {item.unit}</span>
          {item.taxRate > 0 && (
            <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[9px]">
              {item.taxRate}%
            </Badge>
          )}
        </div>
      </div>
      <Check className="ml-1 h-4 w-4 shrink-0 opacity-0 text-primary group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-1.5 p-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-md px-2 py-2 animate-pulse"
        >
          <div className="h-5 w-16 rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 rounded bg-muted" />
            <div className="h-2 w-48 rounded bg-muted/60" />
          </div>
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
