"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function TrackForm() {
  const t = useTranslations();
  const router = useRouter();
  const [code, setCode] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (trimmed) router.push(`/portal/track/${trimmed}`);
      }}
      className="flex gap-2"
    >
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={t("portal.trackPlaceholder")}
        className="h-12 text-base"
      />
      <Button type="submit" size="lg">
        {t("portal.track")} <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}
