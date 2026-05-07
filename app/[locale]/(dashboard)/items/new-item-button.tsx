"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemDialog, type ItemDialogValue } from "./item-dialog";

export function NewItemButton() {
  const t = useTranslations();
  const tx = (k: string, fb: string) => (t.has(k) ? t(k) : fb);
  return (
    <ItemDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> {tx("items.new", "New item")}
        </Button>
      }
    />
  );
}

export function EditItemButton({ value }: { value: ItemDialogValue }) {
  const t = useTranslations();
  return (
    <ItemDialog
      value={value}
      trigger={
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          {t.has("common.edit") ? t("common.edit") : "Edit"}
        </Button>
      }
    />
  );
}
