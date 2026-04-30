"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

// ---------------------------------------------------------------------------
// Search context — enables in-dropdown text filter for SelectItem children.
// ---------------------------------------------------------------------------

interface SearchContextValue {
  query: string;
  registerVisibility: (id: string, visible: boolean) => void;
}

const SelectSearchContext = React.createContext<SearchContextValue | null>(
  null,
);

function extractText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return extractText(props.children);
  }
  return "";
}

interface SelectContentProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> {
  searchable?: boolean | "auto";
  searchPlaceholder?: string;
  emptyMessage?: string;
}

// Auto-enable search when SelectContent has at least this many SelectItem
// children. Tiny dropdowns (e.g. language pickers) stay uncluttered.
const SEARCH_AUTO_THRESHOLD = 6;

// Best-effort recursive count of valid leaf children. Used solely to decide
// whether to auto-show the search input. Slight over/under counting is fine.
function countLeafChildren(children: React.ReactNode): number {
  let count = 0;
  React.Children.forEach(children, (child) => {
    if (child == null || typeof child === "boolean") return;
    if (Array.isArray(child)) {
      count += countLeafChildren(child);
      return;
    }
    if (React.isValidElement(child)) {
      const elem = child as React.ReactElement<{ children?: React.ReactNode }>;
      // Treat a Fragment as a transparent container.
      if (elem.type === React.Fragment) {
        count += countLeafChildren(elem.props.children);
        return;
      }
      count += 1;
      return;
    }
    count += 1;
  });
  return count;
}

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(
  (
    {
      className,
      children,
      position = "popper",
      searchable = "auto",
      searchPlaceholder,
      emptyMessage,
      ...props
    },
    ref,
  ) => {
    const t = useTranslations();
    const [query, setQuery] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);
    const visibilityRef = React.useRef<Map<string, boolean>>(new Map());
    const [visibleCount, setVisibleCount] = React.useState(0);

    const itemCount = React.useMemo(
      () => countLeafChildren(children),
      [children],
    );
    const isSearchable =
      searchable === "auto"
        ? itemCount >= SEARCH_AUTO_THRESHOLD
        : Boolean(searchable);

    const registerVisibility = React.useCallback(
      (id: string, visible: boolean) => {
        visibilityRef.current.set(id, visible);
        const next = Array.from(visibilityRef.current.values()).filter(
          Boolean,
        ).length;
        setVisibleCount((prev) => (prev === next ? prev : next));
      },
      [],
    );

    const ctxValue = React.useMemo<SearchContextValue>(
      () => ({ query, registerVisibility }),
      [query, registerVisibility],
    );

    const showEmpty = isSearchable && query.trim() !== "" && visibleCount === 0;

    return (
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          ref={ref}
          className={cn(
            "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            position === "popper" && "data-[side=bottom]:translate-y-1",
            className,
          )}
          position={position}
          {...props}
        >
          {isSearchable && (
            <div
              className="flex items-center gap-1.5 border-b border-border/60 px-2 py-1.5"
              onClick={() => inputRef.current?.focus()}
            >
              <Search className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <input
                ref={inputRef}
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "ArrowDown" ||
                    e.key === "ArrowUp" ||
                    e.key === "Enter" ||
                    e.key === "Escape" ||
                    e.key === "Tab"
                  ) {
                    return;
                  }
                  e.stopPropagation();
                }}
                placeholder={searchPlaceholder ?? `${t("common.search")}...`}
                className="h-6 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          )}
          <SelectSearchContext.Provider value={ctxValue}>
            <SelectPrimitive.Viewport
              className={cn(
                "p-1",
                position === "popper" &&
                  "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
              )}
            >
              {children}
              {showEmpty && (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {emptyMessage ?? t("common.noResults")}
                </div>
              )}
            </SelectPrimitive.Viewport>
          </SelectSearchContext.Provider>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    );
  },
);
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, textValue, ...props }, ref) => {
  const ctx = React.useContext(SelectSearchContext);
  const id = React.useId();

  const text = (textValue ?? extractText(children)).toString();
  const q = ctx?.query.trim().toLowerCase() ?? "";
  const visible = !q || text.toLowerCase().includes(q);

  React.useEffect(() => {
    if (!ctx) return;
    ctx.registerVisibility(id, visible);
    return () => {
      ctx.registerVisibility(id, false);
    };
  }, [ctx, id, visible]);

  return (
    <SelectPrimitive.Item
      ref={ref}
      style={visible ? undefined : { display: "none" }}
      textValue={textValue ?? text}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
};
