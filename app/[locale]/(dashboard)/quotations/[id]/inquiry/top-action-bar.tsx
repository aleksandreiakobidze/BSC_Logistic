"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Mail,
  FileSignature,
  Send,
  Trophy,
  XCircle,
  Loader2,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { QuotationStatus } from "@/lib/enums";
import {
  sendQuotationEmail,
} from "../../actions";
import {
  generateQuoteFromSelected,
  markQuotationLost,
  markQuotationWon,
} from "./actions";

interface TopActionBarProps {
  quotationId: string;
  status: string;
  hasSelectedOffers: boolean;
  hasLines: boolean;
  hasPortalUser: boolean;
  onTabChange?: (tab: "inquiry" | "offer") => void;
}

/**
 * Sticky action strip across the top of the quotation page. Mirrors the
 * lifecycle CTAs of the existing sidebar action panel but surfaces them more
 * prominently so the user can drive the RFQ from anywhere on the page.
 *
 * Each button gates on `getAllowedTransitions` semantics, falling through to
 * a disabled state with a tooltip when the precondition isn't met.
 */
export function TopActionBar({
  quotationId,
  status,
  hasSelectedOffers,
  hasLines,
  hasPortalUser,
  onTabChange,
}: TopActionBarProps) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [lostOpen, setLostOpen] = React.useState(false);

  const isPricing = status === QuotationStatus.PRICING;
  const isDraftLike =
    status === QuotationStatus.DRAFT || status === QuotationStatus.COUNTERED;
  const canMarkWon =
    status === QuotationStatus.ACCEPTED ||
    status === QuotationStatus.CONVERTED;
  const isTerminal =
    status === QuotationStatus.WON ||
    status === QuotationStatus.LOST ||
    status === QuotationStatus.CANCELLED;

  async function onSend() {
    setBusy("send");
    try {
      await sendQuotationEmail({ quotationId });
      toast.success(t("quotations.sentSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  async function onMarkWon() {
    setBusy("won");
    try {
      await markQuotationWon(quotationId);
      toast.success(t("quotations.actions.markWon"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isPricing && (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={!hasSelectedOffers || busy !== null}
            onClick={() => {
              setGenerateOpen(true);
              onTabChange?.("inquiry");
            }}
          >
            <FileSignature className="h-4 w-4" />
            {t("quotations.actions.generateQuote")}
          </Button>
        </>
      )}
      {isDraftLike && (
        <Button
          size="sm"
          disabled={!hasLines || !hasPortalUser || busy !== null}
          onClick={onSend}
        >
          {busy === "send" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {t("quotations.actions.send")}
        </Button>
      )}
      {canMarkWon && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={onMarkWon}
        >
          {busy === "won" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trophy className="h-4 w-4" />
          )}
          {t("quotations.actions.markWon")}
        </Button>
      )}
      {!isTerminal && status !== QuotationStatus.CONVERTED && (
        <Button
          size="sm"
          variant="ghost"
          className="text-rose-600 hover:text-rose-700"
          disabled={busy !== null}
          onClick={() => setLostOpen(true)}
        >
          <XCircle className="h-4 w-4" />
          {t("quotations.actions.markLost")}
        </Button>
      )}

      <GenerateQuoteDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        quotationId={quotationId}
        onGenerated={() => {
          onTabChange?.("offer");
          router.refresh();
        }}
      />
      <MarkLostDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        quotationId={quotationId}
        onLost={() => router.refresh()}
      />
    </div>
  );
}

function GenerateQuoteDialog({
  open,
  onOpenChange,
  quotationId,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  quotationId: string;
  onGenerated: () => void;
}) {
  const t = useTranslations();
  const [markup, setMarkup] = React.useState("15");
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await generateQuoteFromSelected({
        quotationId,
        defaultMarkupPercent: Number(markup) || 0,
        replaceExisting: true,
      });
      if (res.ok) {
        toast.success(`+${res.linesCreated} lines`);
        onOpenChange(false);
        onGenerated();
      } else {
        toast.error(res.error.code);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" withDescription>
        <DialogHeader>
          <DialogTitle>{t("quotations.inquiry.generateQuoteTitle")}</DialogTitle>
          <DialogDescription>
            {t("quotations.inquiry.generateQuoteDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gq-markup" className="text-xs">
              {t("quotations.inquiry.generateQuoteMarkup")}
            </Label>
            <Input
              id="gq-markup"
              type="number"
              min={0}
              step="0.5"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("quotations.inquiry.generateQuoteSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MarkLostDialog({
  open,
  onOpenChange,
  quotationId,
  onLost,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  quotationId: string;
  onLost: () => void;
}) {
  const t = useTranslations();
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await markQuotationLost({ quotationId, reason: reason || undefined });
      toast.success(t("quotations.actions.markLost"));
      onOpenChange(false);
      onLost();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" withDescription>
        <DialogHeader>
          <DialogTitle>{t("quotations.inquiry.markLostTitle")}</DialogTitle>
          <DialogDescription>
            {t("quotations.inquiry.markLostDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ml-reason" className="text-xs">
              {t("quotations.inquiry.markLostReason")}
            </Label>
            <Textarea
              id="ml-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("quotations.inquiry.markLostSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
