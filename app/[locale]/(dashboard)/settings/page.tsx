import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/actions";
import { SettingsView, type SettingsData } from "./settings-view";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { orgId } = await requireOrg();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    org,
    branches,
    users,
    invitations,
    vehicles,
    members,
    shipmentsThisMonth,
  ] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.branch.findMany({ where: { orgId } }),
    prisma.user.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invitation.findMany({
      where: { orgId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vehicle.count({ where: { orgId } }),
    prisma.user.count({ where: { orgId, isActive: true } }),
    prisma.shipment.count({ where: { orgId, createdAt: { gte: monthStart } } }),
  ]);

  const data: SettingsData = {
    locale,
    org: org
      ? { id: org.id, name: org.name, baseCurrency: org.baseCurrency, locale: org.locale }
      : null,
    branches: branches.map((b) => ({
      id: b.id,
      name: b.name,
      city: b.city,
      country: b.country,
      phone: b.phone,
    })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
    })),
    counts: {
      vehicles,
      members,
      shipmentsThisMonth,
    },
    integrations: {
      mapbox: Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN),
      twilio: Boolean(process.env.TWILIO_AUTH_TOKEN),
      resend: Boolean(process.env.RESEND_API_KEY),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      quickbooks: false,
      slack: false,
    },
  };

  return <SettingsView data={data} />;
}
