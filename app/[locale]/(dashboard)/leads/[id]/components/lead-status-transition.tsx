"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, UserCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadStatus } from "@/lib/enums";
import {
  checkLeadTransition,
  getAllTransitionTargets,
  type LeadForCheck,
} from "@/lib/lead-transitions";
import { RequireContactDialog } from "./require-contact-dialog";
import { LostReasonDialog } from "./lost-reason-dialog";
import { QualificationWizard } from "../qualification-wizard";
import type { CustomerSnapshot } from "@/components/app/customer-picker";
import type { ContactSnapshot } from "@/components/app/contact-picker";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  estimatedValue: number;
  currency: string;
  status: string;
  contactId: string | null;
  customerId: string | null;
  contact: ContactSnapshot | null;
  customer: CustomerSnapshot | null;
};

/**
 * Action bar shown on the lead detail page. Renders only the transitions
 * that are allowed from the current status. Buttons that fail the gate
 * (e.g. "Qualify" without a customer link) open the appropriate inline
 * fix dialog instead of being hidden — that way the user always has a
 * path forward.
 */
export function LeadStatusTransition({ lead }: { lead: Lead }) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const [contactDialog, setContactDialog] = React.useState(false);
  const [lostDialog, setLostDialog] = React.useState(false);
  const [qualifyDialog, setQualifyDialog] = React.useState(false);

  // Auto-open dialogs when user lands here from a Kanban drop. The Kanban
  // appends `?action=contact|qualify|lost` so the user keeps their flow.
  React.useEffect(() => {
    const action = searchParams.get("action");
    if (action === "contact") setContactDialog(true);
    else if (action === "qualify") setQualifyDialog(true);
    else if (action === "lost") setLostDialog(true);
  }, [searchParams]);

  const leadForCheck: LeadForCheck = {
    status: lead.status as LeadStatus,
    contactId: lead.contactId,
    customerId: lead.customerId,
    contact: lead.contact
      ? {
          name: lead.contact.name ?? null,
          phone: lead.contact.phone ?? null,
          email: lead.contact.email ?? null,
        }
      : null,
  };

  const targets = getAllTransitionTargets(lead.status as LeadStatus);
  if (targets.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {targets.map((target) => {
          const check = checkLeadTransition(leadForCheck, target);
          if (target === LeadStatus.CONTACTED) {
            return (
              <Button
                key={target}
                variant="default"
                size="sm"
                onClick={() => setContactDialog(true)}
              >
                <UserCheck className="mr-2 h-4 w-4" />
                {t("leads.transition.actions.markContacted")}
              </Button>
            );
          }
          if (target === LeadStatus.QUALIFIED) {
            return (
              <Button
                key={target}
                variant="default"
                size="sm"
                onClick={() => setQualifyDialog(true)}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t("leads.transition.actions.qualify")}
              </Button>
            );
          }
          if (target === LeadStatus.LOST) {
            return (
              <Button
                key={target}
                variant="outline"
                size="sm"
                onClick={() => setLostDialog(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {t("leads.transition.actions.markLost")}
              </Button>
            );
          }
          // Should never happen — keep TS happy.
          void check;
          return null;
        })}
      </div>

      <RequireContactDialog
        leadId={lead.id}
        open={contactDialog}
        onOpenChange={setContactDialog}
        defaults={{
          name: lead.contact?.name ?? lead.name,
          email: lead.contact?.email ?? lead.email,
          phone: lead.contact?.phone ?? lead.phone,
        }}
      />
      <LostReasonDialog
        leadId={lead.id}
        open={lostDialog}
        onOpenChange={setLostDialog}
      />
      <QualificationWizard
        lead={{
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          notes: lead.notes,
          estimatedValue: lead.estimatedValue,
          currency: lead.currency,
          contact: lead.contact,
          customer: lead.customer,
        }}
        open={qualifyDialog}
        onOpenChange={setQualifyDialog}
        trigger={null}
      />
    </>
  );
}
