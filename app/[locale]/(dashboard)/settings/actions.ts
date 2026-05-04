"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg, requireRole } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { enqueueNotification } from "@/lib/queue";
import { Role } from "@/lib/enums";
import type { InvoiceTemplate } from "@/lib/invoice-template";
import { parseTemplate } from "@/lib/invoice-template";

const orgSchema = z.object({
  name: z.string().min(1),
  baseCurrency: z.string().min(1).default("USD"),
  locale: z.enum(["en", "ka", "ru"]).default("en"),
});

export async function updateOrganization(formData: FormData) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  const data = orgSchema.parse(Object.fromEntries(formData.entries()));
  await prisma.organization.update({ where: { id: orgId }, data });
  await audit({
    action: "org.update",
    entity: "Organization",
    entityId: orgId,
    orgId,
    userId: session.user.id,
  });
  revalidatePath("/settings");
  return { ok: true };
}

const branchSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function createBranch(formData: FormData) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  const data = branchSchema.parse(Object.fromEntries(formData.entries()));
  const b = await prisma.branch.create({ data: { orgId, ...data } });
  await audit({ action: "branch.create", entity: "Branch", entityId: b.id, orgId, userId: session.user.id });
  revalidatePath("/settings");
  return { ok: true };
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Role).default(Role.DISPATCHER),
});

export async function inviteUser(formData: FormData) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  const data = inviteSchema.parse(Object.fromEntries(formData.entries()));

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const inv = await prisma.invitation.create({
    data: {
      email: data.email,
      role: data.role,
      orgId,
      invitedById: session.user.id,
      token,
      expiresAt,
    },
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invite/${token}`;
  await enqueueNotification("email", {
    to: data.email,
    subject: "You've been invited to BSC Logistics",
    body: `<p>You've been invited to join as ${data.role}.</p><p><a href="${inviteUrl}">Accept invitation</a></p>`,
  });

  await audit({
    action: "invite.create",
    entity: "Invitation",
    entityId: inv.id,
    orgId,
    userId: session.user.id,
    meta: { email: data.email, role: data.role },
  });
  revalidatePath("/settings");
  return { ok: true };
}

const blockSchema = z.object({
  id: z.enum([
    "header",
    "billTo",
    "details",
    "table",
    "totals",
    "payments",
    "notes",
    "paymentTerms",
    "bankDetails",
    "footer",
  ]),
  label: z.string(),
  visible: z.boolean(),
  fontSize: z.number().int().min(6).max(48),
  fontWeight: z.enum(["normal", "medium", "bold"]),
  color: z.string(),
  bgColor: z.string(),
  align: z.enum(["left", "center", "right"]),
});

const lineColumnsSchema = z.object({
  qty: z.boolean(),
  unitPrice: z.boolean(),
  taxRate: z.boolean(),
  discount: z.boolean(),
  lineTotal: z.boolean(),
});

const labelsSchema = z
  .object({
    invoice: z.string().optional(),
    billTo: z.string().optional(),
    qty: z.string().optional(),
    unitPrice: z.string().optional(),
    description: z.string().optional(),
    taxRate: z.string().optional(),
    discount: z.string().optional(),
    lineTotal: z.string().optional(),
    subtotal: z.string().optional(),
    tax: z.string().optional(),
    total: z.string().optional(),
    paid: z.string().optional(),
    balance: z.string().optional(),
    notes: z.string().optional(),
    paymentTerms: z.string().optional(),
    bankDetails: z.string().optional(),
    issueDate: z.string().optional(),
    dueDate: z.string().optional(),
    invoiceNumber: z.string().optional(),
  })
  .partial();

const templateSchema = z.object({
  primaryColor: z.string(),
  accentColor: z.string(),
  pageSize: z.enum(["A4", "Letter"]),
  fontFamily: z.enum(["Helvetica", "Times-Roman", "Courier"]),
  showLogo: z.boolean(),
  logoPosition: z.enum(["left", "right"]),
  footerText: z.string().default(""),
  notes: z.string().default(""),
  paymentTerms: z.string().default(""),
  bankDetails: z.string().default(""),
  lineColumns: lineColumnsSchema,
  labels: labelsSchema.default({}),
  signature: z.object({ enabled: z.boolean(), label: z.string() }),
  blocks: z.array(blockSchema),
});

export async function saveInvoiceTemplate(template: InvoiceTemplate) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  // Re-run through parseTemplate so partial updates from the autosave path
  // always merge cleanly with defaults before zod validates.
  const merged = parseTemplate(JSON.stringify(template));
  const parsed = templateSchema.parse(merged);
  await prisma.organization.update({
    where: { id: orgId },
    data: { invoiceTemplate: JSON.stringify(parsed) },
  });
  await audit({
    action: "org.invoiceTemplate.save",
    entity: "Organization",
    entityId: orgId,
    orgId,
    userId: session.user.id,
  });
  revalidatePath("/settings/invoice-designer");
  return { ok: true };
}

export async function updateOrganizationLogo(logoUrl: string | null) {
  const { session, orgId } = await requireRole(["ADMIN"]);
  await prisma.organization.update({
    where: { id: orgId },
    data: { logoUrl: logoUrl?.trim() || null },
  });
  await audit({
    action: "org.logo.update",
    entity: "Organization",
    entityId: orgId,
    orgId,
    userId: session.user.id,
  });
  revalidatePath("/settings/invoice-designer");
  return { ok: true };
}
