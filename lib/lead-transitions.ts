import { LeadStatus } from "./enums";

export type LeadForCheck = {
  status: LeadStatus;
  contactId: string | null;
  customerId: string | null;
  contact: {
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

export type TransitionTarget = Exclude<
  LeadStatus,
  typeof LeadStatus.NEW
>;

export type TransitionError =
  | { code: "INVALID_TRANSITION"; from: LeadStatus; to: TransitionTarget }
  | { code: "LEAD_TERMINAL"; status: LeadStatus }
  | { code: "CONTACT_REQUIRED" }
  | { code: "CONTACT_INVALID"; reason: "name" | "phoneOrEmail" }
  | { code: "CUSTOMER_REQUIRED" };

const ALLOWED: Record<LeadStatus, TransitionTarget[]> = {
  [LeadStatus.NEW]: [LeadStatus.CONTACTED, LeadStatus.LOST],
  [LeadStatus.CONTACTED]: [LeadStatus.QUALIFIED, LeadStatus.LOST],
  [LeadStatus.QUALIFIED]: [LeadStatus.LOST],
  [LeadStatus.LOST]: [],
};

export function checkLeadTransition(
  lead: LeadForCheck,
  next: TransitionTarget,
): { ok: true } | { ok: false; error: TransitionError } {
  const allowed = ALLOWED[lead.status];

  if (allowed.length === 0) {
    return {
      ok: false,
      error: { code: "LEAD_TERMINAL", status: lead.status },
    };
  }
  if (!allowed.includes(next)) {
    return {
      ok: false,
      error: { code: "INVALID_TRANSITION", from: lead.status, to: next },
    };
  }

  if (next === LeadStatus.CONTACTED || next === LeadStatus.QUALIFIED) {
    if (!lead.contactId || !lead.contact) {
      return { ok: false, error: { code: "CONTACT_REQUIRED" } };
    }
    if (!lead.contact.name?.trim()) {
      return {
        ok: false,
        error: { code: "CONTACT_INVALID", reason: "name" },
      };
    }
    const hasPhone = !!lead.contact.phone?.trim();
    const hasEmail = !!lead.contact.email?.trim();
    if (!hasPhone && !hasEmail) {
      return {
        ok: false,
        error: { code: "CONTACT_INVALID", reason: "phoneOrEmail" },
      };
    }
  }

  if (next === LeadStatus.QUALIFIED) {
    if (!lead.customerId) {
      return { ok: false, error: { code: "CUSTOMER_REQUIRED" } };
    }
  }

  return { ok: true };
}

export function getAvailableTransitions(lead: LeadForCheck): TransitionTarget[] {
  return ALLOWED[lead.status].filter(
    (next) => checkLeadTransition(lead, next).ok,
  );
}

export function getAllTransitionTargets(status: LeadStatus): TransitionTarget[] {
  return ALLOWED[status];
}
