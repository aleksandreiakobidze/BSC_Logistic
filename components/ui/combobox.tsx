"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string | undefined) => void;
  onSearch?: (q: string) => Promise<ComboboxOption[]> | ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  footer?: React.ReactNode;
  loading?: boolean;
}

export function Combobox({
  options: initialOptions,
  value,
  onValueChange,
  onSearch,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results.",
  className,
  triggerClassName,
  disabled,
  footer,
  loading: externalLoading,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<ComboboxOption[]>(initialOptions);
  const [loading, setLoading] = React.useState(false);
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    setItems(initialOptions);
  }, [initialOptions]);

  React.useEffect(() => {
    if (!onSearch) {
      const q = query.trim().toLowerCase();
      if (!q) {
        setItems(initialOptions);
        return;
      }
      setItems(
        initialOptions.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            o.description?.toLowerCase().includes(q),
        ),
      );
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await onSearch(query);
        setItems(res);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, onSearch, initialOptions]);

  const selected = React.useMemo(
    () => [...initialOptions, ...items].find((o) => o.value === value),
    [initialOptions, items, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="truncate text-left">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[--radix-popover-trigger-width] p-0", className)} align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
          />
          {(loading || externalLoading) && (
            <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin opacity-50" />
          )}
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            items.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onValueChange?.(isSelected ? undefined : opt.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent/60",
                  )}
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1">
                    <span className="block">{opt.label}</span>
                    {opt.description && (
                      <span className="block text-xs text-muted-foreground">
                        {opt.description}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {footer && <div className="border-t p-2">{footer}</div>}
      </PopoverContent>
    </Popover>
  );
}
