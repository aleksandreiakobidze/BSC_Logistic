"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { CustomFieldEntity } from "@/lib/custom-fields";
import { saveCustomFieldValues } from "../settings/custom-fields/actions";
import { ContactStatus, ContactRelationshipType } from "@/lib/enums";

const contactSchema = z.object({
  customerId: z.string().optional(),
  name: z.string().min(1),
  jobTitle: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  taxId: z.string().max(50).optional(),
  industry: z.string().optional(),
  status: z
    .enum([
      ContactStatus.ACTIVE,
      ContactStatus.INACTIVE,
      ContactStatus.SUSPENDED,
    ])
    .optional(),
  relationshipType: z
    .enum(
      Object.values(ContactRelationshipType) as [string, ...string[]],
    )
    .optional(),
  notes: z.string().optional(),
});

async function nextContactCode(orgId: string): Promise<string> {
  const count = await prisma.contact.count({ where: { orgId } });
  return "CNT-" + String(count + 1).padStart(6, "0");
}

export async function createContact(formData: FormData) {
  const { session, orgId } = await requireOrg();
  const raw = Object.fromEntries(formData.entries());
  const data = contactSchema.parse(raw);

  let customerId: string | null = null;
  if (data.customerId && data.customerId !== "none") {
    const customer = await prisma.customer.findFirstOrThrow({
      where: { id: data.customerId, orgId },
    });
    customerId = customer.id;
  }

  if (data.taxId) {
    const dup = await prisma.contact.findFirst({
      where: { orgId, taxId: data.taxId },
      select: { id: true },
    });
    if (dup) throw new Error("Tax ID already exists for another contact.");
  }

  let code: string;
  let retries = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    code = await nextContactCode(orgId);
    try {
      const contact = await prisma.contact.create({
        data: {
          orgId,
          code,
          customerId,
          name: data.name,
          jobTitle: data.jobTitle || null,
          email: data.email || null,
          phone: data.phone || null,
          company: data.company || null,
          taxId: data.taxId || null,
          industry: data.industry || null,
          status: data.status || ContactStatus.ACTIVE,
          relationshipType: data.relationshipType || ContactRelationshipType.OTHER,
          notes: data.notes || null,
        },
      });

      await saveCustomFieldValues({
        orgId,
        entityType: CustomFieldEntity.CONTACT,
        recordId: contact.id,
        formData,
      });

      await audit({
        action: "contact.create",
        entity: "Contact",
        entityId: contact.id,
        orgId,
        userId: session.user.id,
        meta: { code, customerId },
      });

      revalidatePath("/contacts");
      if (customerId) revalidatePath(`/customers/${customerId}`);
      return { ok: true, id: contact.id };
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002" &&
        retries < 3
      ) {
        retries++;
        continue;
      }
      throw err;
    }
  }
}

export async function updateContact(id: string, formData: FormData) {
  const { session, orgId } = await requireOrg();
  const raw = Object.fromEntries(formData.entries());
  const data = contactSchema.parse(raw);

  const existing = await prisma.contact.findFirstOrThrow({
    where: { id },
    select: { id: true, orgId: true, customerId: true },
  });

  if (existing.orgId !== orgId) throw new Error("Forbidden");

  if (data.taxId) {
    const dup = await prisma.contact.findFirst({
      where: { orgId, taxId: data.taxId, id: { not: id } },
      select: { id: true },
    });
    if (dup) throw new Error("Tax ID already exists for another contact.");
  }

  const newCustomerId =
    data.customerId && data.customerId !== "none" ? data.customerId : null;

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      name: data.name,
      jobTitle: data.jobTitle || null,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      taxId: data.taxId || null,
      industry: data.industry || null,
      status: data.status || undefined,
      relationshipType: data.relationshipType || undefined,
      notes: data.notes || null,
      customerId: newCustomerId,
    },
  });

  await saveCustomFieldValues({
    orgId,
    entityType: CustomFieldEntity.CONTACT,
    recordId: contact.id,
    formData,
  });

  await audit({
    action: "contact.update",
    entity: "Contact",
    entityId: contact.id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/contacts");
  if (existing.customerId) revalidatePath(`/customers/${existing.customerId}`);
  return { ok: true };
}

export async function deleteContact(id: string) {
  const { session, orgId } = await requireOrg();

  const existing = await prisma.contact.findFirstOrThrow({
    where: { id },
    select: { id: true, orgId: true, customerId: true },
  });

  if (existing.orgId !== orgId) throw new Error("Forbidden");

  await prisma.contact.delete({ where: { id } });

  await audit({
    action: "contact.delete",
    entity: "Contact",
    entityId: id,
    orgId,
    userId: session.user.id,
  });

  revalidatePath("/contacts");
  if (existing.customerId) revalidatePath(`/customers/${existing.customerId}`);
}

export async function searchContacts(q: string) {
  const { orgId } = await requireOrg();
  const trimmed = q.trim();
  return prisma.contact.findMany({
    where: {
      orgId,
      ...(trimmed
        ? {
            OR: [
              { name: { contains: trimmed } },
              { email: { contains: trimmed } },
              { phone: { contains: trimmed } },
              { company: { contains: trimmed } },
              { code: { contains: trimmed } },
              { taxId: { contains: trimmed } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      customerId: true,
    },
    orderBy: { name: "asc" },
    take: 20,
  });
}

export type CreateContactQuickResult =
  | {
      ok: true;
      contact: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        company: string | null;
      };
    }
  | { ok: false; error: "NAME_REQUIRED" | "PHONE_OR_EMAIL_REQUIRED" };

/**
 * Quick-create a Contact from a picker / inline form. Returns a discriminated
 * union instead of throwing for the two known input-validation cases — that
 * keeps the HTTP response 200 (no spooky 500 in DevTools) while the client
 * shows a friendly toast.
 */
export async function createContactQuick(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}): Promise<CreateContactQuickResult> {
  const { session, orgId } = await requireOrg();
  if (!input.name?.trim()) {
    return { ok: false, error: "NAME_REQUIRED" };
  }
  // Mirror the lead-transition gate: a usable contact needs at least one of
  // phone/email so callers can never create an unreachable contact via this
  // shortcut.
  if (!input.email?.trim() && !input.phone?.trim()) {
    return { ok: false, error: "PHONE_OR_EMAIL_REQUIRED" };
  }

  const code = await nextContactCode(orgId);
  const contact = await prisma.contact.create({
    data: {
      orgId,
      code,
      name: input.name.trim(),
      email: input.email || null,
      phone: input.phone || null,
      company: input.company || null,
    },
  });

  await audit({
    action: "contact.create",
    entity: "Contact",
    entityId: contact.id,
    orgId,
    userId: session.user.id,
    meta: { source: "quickCreate" },
  });

  revalidatePath("/contacts");
  return {
    ok: true,
    contact: {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
    },
  };
}

export async function listContactLookups(kind: "INDUSTRY" | "JOB_TITLE") {
  const { orgId } = await requireOrg();
  return prisma.contactLookupValue.findMany({
    where: { orgId, kind },
    orderBy: { sortOrder: "asc" },
    select: { id: true, value: true, sortOrder: true },
  });
}

export async function addContactLookup(
  kind: "INDUSTRY" | "JOB_TITLE",
  value: string,
) {
  const { orgId } = await requireOrg();
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Value is required");

  const count = await prisma.contactLookupValue.count({
    where: { orgId, kind },
  });

  try {
    const created = await prisma.contactLookupValue.create({
      data: { orgId, kind, value: trimmed, sortOrder: count },
    });
    return { ok: true, id: created.id };
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { ok: true, existing: true };
    }
    throw err;
  }
}

export async function removeContactLookup(id: string) {
  const { orgId } = await requireOrg();
  const existing = await prisma.contactLookupValue.findFirst({
    where: { id, orgId },
  });
  if (!existing) throw new Error("Not found");
  await prisma.contactLookupValue.delete({ where: { id } });
  return { ok: true };
}
