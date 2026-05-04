"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus, UserCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Combobox,
  type ComboboxOption,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  searchContacts,
  createContactQuick,
} from "@/app/[locale]/(dashboard)/contacts/actions";

export interface ContactSnapshot {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

interface ContactPickerProps {
  value?: string;
  initialContact?: ContactSnapshot;
  onChange: (contact: ContactSnapshot | undefined) => void;
  className?: string;
}

export function ContactPicker({
  value,
  initialContact,
  onChange,
  className,
}: ContactPickerProps) {
  const t = useTranslations();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState<ContactSnapshot | undefined>(
    initialContact,
  );
  const [options, setOptions] = React.useState<ComboboxOption[]>(
    initialContact
      ? [
          {
            value: initialContact.id,
            label: initialContact.name,
            description:
              initialContact.email ||
              initialContact.phone ||
              initialContact.company ||
              undefined,
          },
        ]
      : [],
  );
  const cacheRef = React.useRef<Map<string, ContactSnapshot>>(new Map());

  React.useEffect(() => {
    if (initialContact) {
      cacheRef.current.set(initialContact.id, initialContact);
    }
  }, [initialContact]);

  const handleSearch = React.useCallback(async (q: string) => {
    const results = await searchContacts(q);
    for (const r of results) {
      cacheRef.current.set(r.id, r);
    }
    return results.map((r) => ({
      value: r.id,
      label: r.name,
      description:
        r.email || r.phone || r.company || undefined,
    }));
  }, []);

  const handleSelect = (newValue: string | undefined) => {
    if (!newValue) {
      setSnapshot(undefined);
      onChange(undefined);
      return;
    }
    const found = cacheRef.current.get(newValue);
    if (found) {
      setSnapshot(found);
      onChange(found);
    }
  };

  async function onQuickCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      toast.error(t("common.error"));
      return;
    }
    setCreating(true);
    try {
      const created = await createContactQuick({
        name,
        email: String(fd.get("email") ?? "") || null,
        phone: String(fd.get("phone") ?? "") || null,
        company: String(fd.get("company") ?? "") || null,
      });
      cacheRef.current.set(created.id, created);
      setOptions((prev) => [
        {
          value: created.id,
          label: created.name,
          description:
            created.email || created.phone || created.company || undefined,
        },
        ...prev.filter((o) => o.value !== created.id),
      ]);
      setSnapshot(created);
      onChange(created);
      toast.success(t("contacts.created"));
      setCreateOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={className}>
      <Combobox
        options={options}
        value={value}
        onValueChange={handleSelect}
        onSearch={handleSearch}
        placeholder={t("leads.contactPlaceholder")}
        searchPlaceholder={t("leads.searchContacts")}
        emptyMessage={t("contacts.empty")}
        footer={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t("leads.createNewContact")}
          </Button>
        }
      />
      {snapshot && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <UserCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{snapshot.name}</div>
            <div className="text-muted-foreground">
              {[snapshot.email, snapshot.phone, snapshot.company]
                .filter(Boolean)
                .join(" · ") || "—"}
            </div>
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md" withDescription>
          <DialogHeader>
            <DialogTitle>{t("leads.createNewContact")}</DialogTitle>
            <DialogDescription>
              {t("contacts.newContactDescription")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onQuickCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-name">{t("common.name")}</Label>
              <Input id="cp-name" name="name" required autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-email">{t("common.email")}</Label>
                <Input id="cp-email" name="email" type="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-phone">{t("common.phone")}</Label>
                <Input id="cp-phone" name="phone" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-company">{t("leads.company")}</Label>
              <Input id="cp-company" name="company" />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={creating} className="gap-1.5">
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
