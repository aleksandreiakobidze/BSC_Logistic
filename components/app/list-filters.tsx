"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FilterOption = { label: string; value: string };

export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "date";
  options?: FilterOption[];
  placeholder?: string;
}

interface ListFiltersProps {
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  className?: string;
}

const ALL_VALUE = "__all__";

export function ListFilters({
  searchPlaceholder = "Search…",
  filters = [],
  className,
}: ListFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  function buildUrl(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === "" || v === ALL_VALUE) {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    });
    params.delete("page");
    return `${pathname}?${params.toString()}`;
  }

  function handleSearch(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        router.push(buildUrl({ q: value || null }));
      });
    }, 350);
  }

  function handleFilter(key: string, value: string) {
    startTransition(() => {
      router.push(buildUrl({ [key]: value === ALL_VALUE ? null : value }));
    });
  }

  function clearAll() {
    const params = new URLSearchParams();
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
    setQ("");
  }

  const activeCount =
    (q ? 1 : 0) +
    filters.filter((f) => {
      const v = searchParams.get(f.key);
      return v && v !== ALL_VALUE;
    }).length;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9 pr-8 h-9"
        />
        {q && (
          <button
            onClick={() => handleSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {filters.map((f) => {
        if (f.type === "select") {
          return (
            <Select
              key={f.key}
              value={searchParams.get(f.key) ?? ALL_VALUE}
              onValueChange={(v) => handleFilter(f.key, v)}
            >
              <SelectTrigger className="h-9 w-[160px] text-sm">
                <SlidersHorizontal className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{f.placeholder ?? `All ${f.label}`}</SelectItem>
                {f.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        if (f.type === "date") {
          return (
            <input
              key={f.key}
              type="date"
              value={searchParams.get(f.key) ?? ""}
              onChange={(e) => handleFilter(f.key, e.target.value)}
              placeholder={f.label}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              title={f.label}
            />
          );
        }
        return null;
      })}

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear
          <Badge variant="secondary" className="h-4 w-4 p-0 text-[10px] flex items-center justify-center">
            {activeCount}
          </Badge>
        </Button>
      )}
    </div>
  );
}
