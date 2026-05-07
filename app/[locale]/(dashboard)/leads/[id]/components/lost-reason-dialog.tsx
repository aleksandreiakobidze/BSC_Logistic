"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateLeadStatus } from "../../actions";
import { LeadStatus } from "@/lib/enums";

export function LostReasonDialog({
  leadId,
  open,
  onOpenChange,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setSubmitting(false);
    }
  }, [open]);

  async function onSubmit() {
    if (!reason.trim()) {
      toast.error(t("leads.transition.errors.LOST_REASON_REQUIRED"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await updateLeadStatus({
        leadId,
        nextStatus: LeadStatus.LOST,
        lostReason: reason.trim(),
      });
      if (!res.ok) {
        const code =
          "code" in res.error ? res.error.code : "INVALID_TRANSITION";
        toast.error(t(`leads.transition.errors.${code}`));
        return;
      }
      toast.success(t("leads.transition.actions.markLost"));
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" withDescription>
        <DialogHeader>
          <DialogTitle>{t("leads.transition.actions.markLost")}</DialogTitle>
          <DialogDescription>
            {t("leads.transition.errors.LOST_REASON_REQUIRED")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="lost-reason">{t("leads.lostReason")}</Label>
          <Textarea
            id="lost-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            required
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onSubmit}
            disabled={submitting}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {t("leads.transition.actions.markLost")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
