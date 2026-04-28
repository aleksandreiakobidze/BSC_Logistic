"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOrganization } from "./actions";

export function OrgForm({ org }: { org: { id: string; name: string; baseCurrency: string; locale: string } }) {
  const [locale, setLocale] = React.useState(org.locale);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    try {
      const fd = new FormData(form);
      fd.set("locale", locale);
      await updateOrganization(fd);
      toast.success("Saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2 space-y-1.5">
        <Label className="text-xs">Organization name</Label>
        <Input name="name" defaultValue={org.name} required />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Base currency</Label>
        <Input name="baseCurrency" defaultValue={org.baseCurrency} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Default locale</Label>
        <Select value={locale} onValueChange={setLocale}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ka">ქართული</SelectItem>
            <SelectItem value="ru">Русский</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </form>
  );
}
