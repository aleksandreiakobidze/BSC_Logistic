"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { convertToCustomer } from "../actions";

export function ConvertButton({
  leadId,
  leadName,
}: {
  leadId: string;
  leadName: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleConvert() {
    if (
      !confirm(
        t("leads.convertConfirm", { name: leadName }),
      )
    )
      return;
    setLoading(true);
    try {
      const res = await convertToCustomer(leadId);
      if (res.ok) {
        toast.success(t("leads.convertedSuccess"));
        router.push(`/customers/${res.customerId}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleConvert} disabled={loading} variant="default">
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <UserCheck className="mr-2 h-4 w-4" />
      )}
      {t("leads.convertToCustomer")}
    </Button>
  );
}
