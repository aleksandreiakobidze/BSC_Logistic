"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  UserCheck,
  Building2,
  UserCircle2,
  ListChecks,
  Plus,
  Search,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CustomerPicker,
  type CustomerSnapshot,
} from "@/components/app/customer-picker";
import {
  ContactPicker,
  type ContactSnapshot,
} from "@/components/app/contact-picker";
import { qualifyLead, type QualifyLeadInput } from "../actions";
import { createQuotation } from "@/app/[locale]/(dashboard)/quotations/actions";

type WizardStep = "customer" | "contact" | "review";

type CustomerStrategy = "create" | "link";
type ContactStrategy = "create" | "link" | "skip";

interface CustomerForm {
  name: string;
  code: string;
  email: string;
  phone: string;
  taxId: string;
  address: string;
  city: string;
  country: string;
  notes: string;
}

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  position: string;
  company: string;
}

interface LeadSeed {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  estimatedValue: number;
  currency: string;
  contact: ContactSnapshot | null;
  customer: CustomerSnapshot | null;
}

export function QualificationWizard({ lead }: { lead: LeadSeed }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<WizardStep>("customer");
  const [submitting, setSubmitting] = React.useState(false);

  // Customer state
  const [customerStrategy, setCustomerStrategy] =
    React.useState<CustomerStrategy>(lead.customer ? "link" : "create");
  const [linkedCustomer, setLinkedCustomer] = React.useState<
    CustomerSnapshot | undefined
  >(lead.customer ?? undefined);
  const [customerForm, setCustomerForm] = React.useState<CustomerForm>({
    name: lead.company || lead.name,
    code: "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    taxId: "",
    address: "",
    city: "",
    country: "",
    notes: lead.notes ?? "",
  });

  // Contact state
  const [contactStrategy, setContactStrategy] =
    React.useState<ContactStrategy>(lead.contact ? "link" : "create");
  const [linkedContact, setLinkedContact] = React.useState<
    ContactSnapshot | undefined
  >(lead.contact ?? undefined);
  const [contactForm, setContactForm] = React.useState<ContactForm>({
    name: lead.contact?.name ?? lead.name,
    email: lead.contact?.email ?? lead.email ?? "",
    phone: lead.contact?.phone ?? lead.phone ?? "",
    position: "",
    company: lead.contact?.company ?? lead.company ?? "",
  });

  // Quotation toggle
  const [createQuote, setCreateQuote] = React.useState(true);

  function reset() {
    setStep("customer");
    setSubmitting(false);
  }

  function next() {
    if (step === "customer") {
      if (customerStrategy === "link" && !linkedCustomer) {
        toast.error(t("common.error"));
        return;
      }
      if (customerStrategy === "create" && !customerForm.name.trim()) {
        toast.error(t("common.error"));
        return;
      }
      setStep("contact");
    } else if (step === "contact") {
      if (contactStrategy === "link" && !linkedContact) {
        toast.error(t("common.error"));
        return;
      }
      if (contactStrategy === "create" && !contactForm.name.trim()) {
        toast.error(t("common.error"));
        return;
      }
      setStep("review");
    }
  }

  function back() {
    if (step === "review") setStep("contact");
    else if (step === "contact") setStep("customer");
  }

  async function finish() {
    setSubmitting(true);
    try {
      const input: QualifyLeadInput = {
        customer:
          customerStrategy === "link" && linkedCustomer
            ? { strategy: "link", customerId: linkedCustomer.id }
            : {
                strategy: "create",
                data: {
                  name: customerForm.name,
                  code: customerForm.code || undefined,
                  email: customerForm.email || null,
                  phone: customerForm.phone || null,
                  taxId: customerForm.taxId || null,
                  address: customerForm.address || null,
                  city: customerForm.city || null,
                  country: customerForm.country || null,
                  notes: customerForm.notes || null,
                },
              },
        contact:
          contactStrategy === "skip"
            ? { strategy: "skip" }
            : contactStrategy === "link" && linkedContact
              ? { strategy: "link", contactId: linkedContact.id }
              : {
                  strategy: "create",
                  data: {
                    name: contactForm.name,
                    email: contactForm.email || null,
                    phone: contactForm.phone || null,
                    position: contactForm.position || null,
                    company: contactForm.company || null,
                  },
                },
      };

      const res = await qualifyLead(lead.id, input);
      if (!res.ok) throw new Error("Failed");

      let quotationId: string | undefined;
      if (createQuote && res.customerId) {
        const q = await createQuotation({
          customerId: res.customerId,
          contactId: res.contactId ?? null,
          leadId: lead.id,
          currency: lead.currency,
          taxRate: 0,
          discount: 0,
          notes: null,
          lines: [],
        });
        quotationId = q.id;
      }

      toast.success(t("leads.qualifySuccess"));
      setOpen(false);
      reset();
      if (quotationId) router.push(`/quotations/${quotationId}`);
      else if (res.customerId) router.push(`/customers/${res.customerId}`);
      else router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  const stepIndex = step === "customer" ? 0 : step === "contact" ? 1 : 2;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Button onClick={() => setOpen(true)}>
        <UserCheck className="mr-2 h-4 w-4" />
        {t("leads.convertToCustomer")}
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("leads.qualifyTitle")}</DialogTitle>
          <DialogDescription>
            {t("leads.qualifyDescription", { name: lead.name })}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-2">
          {[
            { id: "customer", icon: Building2, label: t("leads.wizard.customer") },
            { id: "contact", icon: UserCircle2, label: t("leads.wizard.contact") },
            { id: "review", icon: ListChecks, label: t("leads.wizard.review") },
          ].map((s, i) => {
            const Icon = s.icon;
            const active = stepIndex === i;
            const done = stepIndex > i;
            return (
              <div
                key={s.id}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active && "bg-background ring-1 ring-border",
                  done && "text-primary",
                  !active && !done && "text-muted-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Step body */}
        <div className="space-y-4">
          {step === "customer" && (
            <CustomerStep
              strategy={customerStrategy}
              setStrategy={setCustomerStrategy}
              linkedCustomer={linkedCustomer}
              setLinkedCustomer={setLinkedCustomer}
              form={customerForm}
              setForm={setCustomerForm}
            />
          )}
          {step === "contact" && (
            <ContactStep
              strategy={contactStrategy}
              setStrategy={setContactStrategy}
              linkedContact={linkedContact}
              setLinkedContact={setLinkedContact}
              form={contactForm}
              setForm={setContactForm}
            />
          )}
          {step === "review" && (
            <ReviewStep
              customerLabel={
                customerStrategy === "link"
                  ? (linkedCustomer?.name ?? "—")
                  : customerForm.name
              }
              contactLabel={
                contactStrategy === "skip"
                  ? "—"
                  : contactStrategy === "link"
                    ? (linkedContact?.name ?? "—")
                    : contactForm.name
              }
              createQuote={createQuote}
              setCreateQuote={setCreateQuote}
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {step !== "customer" ? (
            <Button variant="outline" type="button" onClick={back} disabled={submitting}>
              {t("common.back") ?? "Back"}
            </Button>
          ) : (
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              {t("common.cancel")}
            </Button>
          )}
          {step !== "review" ? (
            <Button type="button" onClick={next}>
              {t("common.next") ?? "Next"}
            </Button>
          ) : (
            <Button type="button" onClick={finish} disabled={submitting} className="gap-1.5">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {createQuote
                ? t("leads.wizard.qualifyAndCreateQuote")
                : t("leads.wizard.qualifyOnly")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerStep({
  strategy,
  setStrategy,
  linkedCustomer,
  setLinkedCustomer,
  form,
  setForm,
}: {
  strategy: CustomerStrategy;
  setStrategy: (s: CustomerStrategy) => void;
  linkedCustomer?: CustomerSnapshot;
  setLinkedCustomer: (c?: CustomerSnapshot) => void;
  form: CustomerForm;
  setForm: React.Dispatch<React.SetStateAction<CustomerForm>>;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-3">
      <StrategyToggle
        value={strategy}
        onChange={setStrategy}
        options={[
          { id: "link", icon: Search, label: t("leads.wizard.linkExisting") },
          { id: "create", icon: Plus, label: t("leads.wizard.createNew") },
        ]}
      />
      {strategy === "link" ? (
        <CustomerPicker
          value={linkedCustomer?.id}
          initialCustomer={linkedCustomer}
          onChange={setLinkedCustomer}
          placeholder={t("customers.title")}
        />
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="qw-cust-name">{t("common.name")}</Label>
            <Input
              id="qw-cust-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qw-cust-email">{t("common.email")}</Label>
              <Input
                id="qw-cust-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="qw-cust-phone">{t("common.phone")}</Label>
              <Input
                id="qw-cust-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qw-cust-city">{t("common.city")}</Label>
              <Input
                id="qw-cust-city"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="qw-cust-country">{t("common.country")}</Label>
              <Input
                id="qw-cust-country"
                value={form.country}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactStep({
  strategy,
  setStrategy,
  linkedContact,
  setLinkedContact,
  form,
  setForm,
}: {
  strategy: ContactStrategy;
  setStrategy: (s: ContactStrategy) => void;
  linkedContact?: ContactSnapshot;
  setLinkedContact: (c?: ContactSnapshot) => void;
  form: ContactForm;
  setForm: React.Dispatch<React.SetStateAction<ContactForm>>;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-3">
      <StrategyToggle
        value={strategy}
        onChange={setStrategy}
        options={[
          { id: "link", icon: Search, label: t("leads.wizard.linkExisting") },
          { id: "create", icon: Plus, label: t("leads.wizard.createNew") },
          { id: "skip", icon: UserCircle2, label: t("leads.wizard.skipContact") },
        ]}
      />
      {strategy === "link" && (
        <ContactPicker
          value={linkedContact?.id}
          initialContact={linkedContact}
          onChange={setLinkedContact}
        />
      )}
      {strategy === "create" && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="qw-ct-name">{t("common.name")}</Label>
            <Input
              id="qw-ct-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qw-ct-email">{t("common.email")}</Label>
              <Input
                id="qw-ct-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="qw-ct-phone">{t("common.phone")}</Label>
              <Input
                id="qw-ct-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="qw-ct-position">{t("contacts.position")}</Label>
            <Input
              id="qw-ct-position"
              value={form.position}
              onChange={(e) =>
                setForm((f) => ({ ...f, position: e.target.value }))
              }
            />
          </div>
        </div>
      )}
      {strategy === "skip" && (
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t("leads.wizard.skipContactHint")}
        </p>
      )}
    </div>
  );
}

function ReviewStep({
  customerLabel,
  contactLabel,
  createQuote,
  setCreateQuote,
}: {
  customerLabel: string;
  contactLabel: string;
  createQuote: boolean;
  setCreateQuote: (v: boolean) => void;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="flex items-center justify-between gap-2 py-1">
          <span className="text-muted-foreground">
            {t("leads.wizard.customer")}
          </span>
          <span className="font-medium">{customerLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-2 py-1">
          <span className="text-muted-foreground">
            {t("leads.wizard.contact")}
          </span>
          <span className="font-medium">{contactLabel}</span>
        </div>
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:bg-muted/30">
        <div className="space-y-0.5">
          <div className="font-medium">
            {t("leads.wizard.createQuotation")}
          </div>
          <div className="text-xs text-muted-foreground">
            {t("leads.wizard.createQuotationHint")}
          </div>
        </div>
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={createQuote}
          onChange={(e) => setCreateQuote(e.target.checked)}
        />
      </label>
    </div>
  );
}

function StrategyToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: {
    id: T;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/40",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
