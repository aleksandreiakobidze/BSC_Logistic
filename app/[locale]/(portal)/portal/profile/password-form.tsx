"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { changePortalPassword } from "./actions";
import { Loader2, Check } from "lucide-react";

export function PasswordForm() {
  const t = useTranslations("portal.profile");
  const tc = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(
    null,
  );

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await changePortalPassword(formData);
      setResult(res);
      if (res.ok) {
        const form = document.getElementById("password-form") as HTMLFormElement;
        form?.reset();
        setTimeout(() => setResult(null), 3000);
      }
    });
  };

  return (
    <form id="password-form" action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">{t("newPassword")}</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={6}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={6}
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
          {t("updatePassword")}
        </Button>
        {result?.ok && (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <Check className="h-3.5 w-3.5" />
            {t("passwordChanged")}
          </span>
        )}
      </div>
    </form>
  );
}
