"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateCustomerProfile } from "./actions";
import { Loader2, Check } from "lucide-react";

export function ProfileForm({
  defaultValues,
}: {
  defaultValues: {
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
  };
}) {
  const t = useTranslations("portal.profile");
  const tc = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(
    null,
  );

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await updateCustomerProfile(formData);
      setResult(res);
      if (res.ok) setTimeout(() => setResult(null), 3000);
    });
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="email">{tc("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues.email}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">{tc("phone")}</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={defaultValues.phone}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="address">{tc("address")}</Label>
          <Input
            id="address"
            name="address"
            defaultValue={defaultValues.address}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">{tc("city")}</Label>
          <Input
            id="city"
            name="city"
            defaultValue={defaultValues.city}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">{tc("country")}</Label>
          <Input
            id="country"
            name="country"
            defaultValue={defaultValues.country}
          />
        </div>
      </div>

      {result?.error && (
        <p className="text-sm text-destructive">{result.error}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          {tc("save")}
        </Button>
        {result?.ok && (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <Check className="h-3.5 w-3.5" />
            {t("saved")}
          </span>
        )}
      </div>
    </form>
  );
}
