"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, UserPlus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ContactPicker,
  type ContactSnapshot,
} from "@/components/app/contact-picker";
import { createContactQuick } from "@/app/[locale]/(dashboard)/contacts/actions";
import { updateLeadStatus } from "../../actions";
import { LeadStatus } from "@/lib/enums";

/**
 * Dialog used by the "Mark Contacted" action when the lead either has no
 * contact yet or its existing contact fails the validity gate (missing
 * name / phone / email). The user can pick an existing org contact or
 * create a new minimal one inline; on submit we attach + flip status in
 * a single server roundtrip.
 */
export function RequireContactDialog({
  leadId,
  open,
  onOpenChange,
  defaults,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: { name?: string; email?: string | null; phone?: string | null };
}) {
  const t = useTranslations();
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [tab, setTab] = React.useState<"link" | "create">("link");
  const [linked, setLinked] = React.useState<ContactSnapshot | undefined>();
  const [name, setName] = React.useState(defaults?.name ?? "");
  const [email, setEmail] = React.useState(defaults?.email ?? "");
  const [phone, setPhone] = React.useState(defaults?.phone ?? "");

  React.useEffect(() => {
    if (open) {
      setTab("link");
      setLinked(undefined);
      setName(defaults?.name ?? "");
      setEmail(defaults?.email ?? "");
      setPhone(defaults?.phone ?? "");
      setSubmitting(false);
    }
  }, [open, defaults?.name, defaults?.email, defaults?.phone]);

  async function onSubmit() {
    setSubmitting(true);
    try {
      let contactId: string;
      if (tab === "link") {
        if (!linked) {
          toast.error(t("common.error"));
          return;
        }
        contactId = linked.id;
      } else {
        if (!name.trim()) {
          toast.error(t("common.error"));
          return;
        }
        if (!email.trim() && !phone.trim()) {
          toast.error(
            t("leads.transition.errors.CONTACT_INVALID_PHONE_OR_EMAIL"),
          );
          return;
        }
        const created = await createContactQuick({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
        });
        if (!created.ok) {
          const key =
            created.error === "PHONE_OR_EMAIL_REQUIRED"
              ? "leads.transition.errors.CONTACT_INVALID_PHONE_OR_EMAIL"
              : "common.error";
          toast.error(t(key));
          return;
        }
        contactId = created.contact.id;
      }

      const res = await updateLeadStatus({
        leadId,
        nextStatus: LeadStatus.CONTACTED,
        attachContactId: contactId,
      });
      if (!res.ok) {
        const code =
          "code" in res.error ? res.error.code : "INVALID_TRANSITION";
        toast.error(t(`leads.transition.errors.${code}`));
        return;
      }
      toast.success(t("leads.transition.actions.markContacted"));
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
          <DialogTitle>{t("leads.transition.actions.markContacted")}</DialogTitle>
          <DialogDescription>
            {t("leads.transition.errors.CONTACT_REQUIRED")}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "link" | "create")}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="link">
              {t("leads.wizard.linkExisting")}
            </TabsTrigger>
            <TabsTrigger value="create">
              {t("leads.wizard.createNew")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-3 pt-3">
            <ContactPicker
              value={linked?.id}
              initialContact={linked}
              onChange={setLinked}
            />
          </TabsContent>

          <TabsContent value="create" className="space-y-3 pt-3">
            <div>
              <Label htmlFor="rc-name">{t("common.name")}</Label>
              <Input
                id="rc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rc-email">{t("common.email")}</Label>
                <Input
                  id="rc-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rc-phone">{t("common.phone")}</Label>
                <Input
                  id="rc-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("leads.transition.errors.CONTACT_INVALID_PHONE_OR_EMAIL")}
            </p>
          </TabsContent>
        </Tabs>

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
            onClick={onSubmit}
            disabled={submitting}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {t("leads.transition.actions.markContacted")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
