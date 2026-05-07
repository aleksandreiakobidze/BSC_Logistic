"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Briefcase, Factory } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  addContactLookup,
  removeContactLookup,
} from "../../contacts/actions";

type LookupItem = { id: string; value: string; sortOrder: number };

export function ContactLookupManager({
  industries,
  jobTitles,
}: {
  industries: LookupItem[];
  jobTitles: LookupItem[];
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <LookupCard
        kind="INDUSTRY"
        icon={<Factory className="h-4 w-4" />}
        items={industries}
      />
      <LookupCard
        kind="JOB_TITLE"
        icon={<Briefcase className="h-4 w-4" />}
        items={jobTitles}
      />
    </div>
  );
}

function LookupCard({
  kind,
  icon,
  items: initial,
}: {
  kind: "INDUSTRY" | "JOB_TITLE";
  icon: React.ReactNode;
  items: LookupItem[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [newVal, setNewVal] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const title =
    kind === "INDUSTRY"
      ? t("contacts.industry")
      : t("contacts.jobTitle");

  async function handleAdd() {
    const trimmed = newVal.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await addContactLookup(kind, trimmed);
      if (res.ok) {
        toast.success(`Added "${trimmed}"`);
        setNewVal("");
        router.refresh();
        setItems((prev) => [
          ...prev,
          { id: res.id ?? "tmp", value: trimmed, sortOrder: prev.length },
        ]);
      }
    } catch {
      toast.error("Failed to add");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeContactLookup(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("Removed");
      router.refresh();
    } catch {
      toast.error("Failed to remove");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={`Add ${title.toLowerCase()}...`}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={loading || !newVal.trim()}
            onClick={handleAdd}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge
              key={item.id}
              variant="secondary"
              className="group gap-1 pr-1"
            >
              {item.value}
              <button
                onClick={() => handleRemove(item.id)}
                className="ml-0.5 rounded-sm opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground">No values yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
