"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Building2,
  Users,
  Map as MapIcon,
  Palette,
  Bell,
  CreditCard,
  Zap,
  Bot,
  SlidersHorizontal,
  FileText,
  Shield,
  Key,
  ChevronRight,
  Search,
  MoreHorizontal,
  ArrowRight,
  Pin,
  Eye,
  Check,
  type LucideIcon,
  Download,
  Upload,
} from "lucide-react";
import { initials } from "@/lib/utils";
import { OrgForm } from "./org-form";
import { NewBranchButton } from "./new-branch-button";
import { InviteUserButton } from "./invite-user-button";
import { ImportSettings } from "./import/import-settings";

type Section = {
  id: string;
  icon: LucideIcon;
  label: string;
  desc: string;
};

export type SettingsData = {
  locale: string;
  org: { id: string; name: string; baseCurrency: string; locale: string } | null;
  branches: Array<{
    id: string;
    name: string;
    city: string | null;
    country: string | null;
    phone: string | null;
    primary?: boolean;
    drivers?: number;
    vehicles?: number;
  }>;
  users: Array<{
    id: string;
    name: string | null;
    email: string;
    role: string;
    isActive: boolean;
    lastSeen?: string;
  }>;
  invitations: Array<{ id: string; email: string; role: string }>;
  counts: {
    vehicles: number;
    members: number;
    shipmentsThisMonth: number;
  };
  integrations: Record<string, boolean>;
};

const SECTIONS: Section[] = [
  { id: "workspace", icon: Building2, label: "Workspace", desc: "Org name, currency, locale" },
  { id: "members", icon: Users, label: "Members", desc: "Team & permissions" },
  { id: "branches", icon: MapIcon, label: "Branches", desc: "Locations & depots" },
  { id: "appearance", icon: Palette, label: "Appearance", desc: "Theme & typography" },
  { id: "notifications", icon: Bell, label: "Notifications", desc: "Alerts & email" },
  { id: "billing", icon: CreditCard, label: "Billing", desc: "Plan & invoices" },
  { id: "integrations", icon: Zap, label: "Integrations", desc: "Maps, SMS, accounting" },
  { id: "automations", icon: Bot, label: "Automations", desc: "Rules & workflows" },
  { id: "fields", icon: SlidersHorizontal, label: "Custom fields", desc: "Schema extensions" },
  { id: "import", icon: Upload, label: "Import", desc: "Required fields & templates" },
  { id: "invoice-tpl", icon: FileText, label: "Invoice designer", desc: "Document templates" },
  { id: "security", icon: Shield, label: "Security", desc: "2FA, sessions, audit" },
  { id: "api", icon: Key, label: "API & webhooks", desc: "Tokens & events" },
];

export function SettingsView({ data }: { data: SettingsData }) {
  const [section, setSection] = React.useState<string>("workspace");
  const [filter, setFilter] = React.useState("");

  React.useEffect(() => {
    const fromHash = () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash.replace("#", "");
      if (hash && SECTIONS.some((s) => s.id === hash)) setSection(hash);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  function go(id: string) {
    setSection(id);
    if (typeof window !== "undefined") {
      history.replaceState(null, "", `#${id}`);
    }
  }

  const filtered = filter
    ? SECTIONS.filter(
        (s) =>
          s.label.toLowerCase().includes(filter.toLowerCase()) ||
          s.desc.toLowerCase().includes(filter.toLowerCase()),
      )
    : SECTIONS;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-dim font-mono text-[11.5px] uppercase tracking-wider">
            Workspace settings
          </div>
          <h1 className="font-display mt-1 text-[26px] font-semibold sm:text-[30px]">
            Settings
          </h1>
          <p className="text-soft mt-1 text-[13.5px]">
            Manage your workspace, team, and integrations.
          </p>
        </div>
        <div className="relative">
          <Search className="text-dim absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2" />
          <input
            className="input w-64 pl-8"
            placeholder="Search settings…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <nav className="card sticky top-4 self-start p-2">
          {filtered.map((s) => {
            const active = section === s.id;
            return (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors"
                style={
                  active
                    ? { background: "hsl(var(--primary) / 0.1)" }
                    : undefined
                }
                onMouseEnter={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "hsl(var(--surface-2))";
                }}
                onMouseLeave={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLButtonElement).style.background = "";
                }}
              >
                <div
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                  style={{
                    background: active
                      ? "hsl(var(--primary))"
                      : "hsl(var(--surface-2))",
                    color: active ? "white" : "hsl(var(--text-muted))",
                  }}
                >
                  <s.icon className="h-[13px] w-[13px]" strokeWidth={active ? 2.2 : 1.6} />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[12.5px] font-medium"
                    style={{
                      color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                    }}
                  >
                    {s.label}
                  </div>
                  <div className="text-dim truncate text-[11px]">{s.desc}</div>
                </div>
                {active && <ChevronRight className="text-dim h-3 w-3" />}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-4">
          {section === "workspace" && <WorkspaceSection data={data} />}
          {section === "members" && <MembersSection data={data} />}
          {section === "branches" && <BranchesSection data={data} />}
          {section === "appearance" && <AppearanceSection />}
          {section === "notifications" && <NotificationsSection />}
          {section === "billing" && <BillingSection data={data} />}
          {section === "integrations" && <IntegrationsSection data={data} />}
          {section === "automations" && (
            <ComingSoon title="Automations" desc="Build event-driven rules: 'When a shipment is delivered, send email to customer.' Workflow editor lands in the next release." />
          )}
          {section === "fields" && (
            <NavCard
              icon={SlidersHorizontal}
              title="Custom fields"
              desc="Add custom attributes to customers, orders, shipments and more."
              href={`/${data.locale}/settings/custom-fields`}
              cta="Open builder"
            />
          )}
          {section === "import" && <ImportSettings />}
          {section === "invoice-tpl" && (
            <NavCard
              icon={FileText}
              title="Invoice designer"
              desc="Design your invoice template — header, footer, columns, branding."
              href={`/${data.locale}/settings/invoice-designer`}
              cta="Open designer"
            />
          )}
          {section === "security" && <SecuritySection />}
          {section === "api" && (
            <ComingSoon
              title="API & webhooks"
              desc="Generate access tokens, sign webhook requests, and inspect delivery logs. Public API rolls out in v2."
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Section helpers                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

function SectionHeader({
  title,
  desc,
  action,
}: {
  title: React.ReactNode;
  desc?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[15px] font-semibold">{title}</div>
        {desc && <div className="text-soft mt-0.5 text-[12.5px]">{desc}</div>}
      </div>
      {action}
    </div>
  );
}

function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card p-12 text-center">
      <div className="text-[14px] font-medium">{title}</div>
      <div className="text-dim mt-1 text-[12.5px]">{desc}</div>
      <span
        className="pill pill-primary mt-3 inline-flex"
        style={{ marginInline: "auto" }}
      >
        Coming soon
      </span>
    </div>
  );
}

function NavCard({
  icon: Icon,
  title,
  desc,
  href,
  cta,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="card flex items-center gap-4 p-6 transition hover:border-[hsl(var(--primary))]"
    >
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
        style={{
          background: "hsl(var(--primary) / 0.12)",
          color: "hsl(var(--primary))",
        }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">{title}</div>
        <div className="text-soft text-[12.5px]">{desc}</div>
      </div>
      <span className="btn">
        {cta} <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Workspace                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

function WorkspaceSection({ data }: { data: SettingsData }) {
  return (
    <>
      <div className="card p-5">
        <SectionHeader
          title="Workspace identity"
          desc="How your organization appears across the app and to customers."
        />
        {data.org && (
          <OrgForm
            org={{
              id: data.org.id,
              name: data.org.name,
              baseCurrency: data.org.baseCurrency,
              locale: data.org.locale,
            }}
          />
        )}
      </div>

      <div
        className="card p-5"
        style={{ borderColor: "hsl(var(--danger) / 0.4)" }}
      >
        <SectionHeader
          title="Danger zone"
          desc="These actions are permanent and cannot be undone."
        />
        <div
          className="flex items-center justify-between gap-3 rounded-xl p-3"
          style={{ background: "hsl(var(--danger) / 0.08)" }}
        >
          <div>
            <div
              className="text-[13px] font-medium"
              style={{ color: "hsl(var(--danger))" }}
            >
              Delete workspace
            </div>
            <div className="text-soft text-[11.5px]">
              All shipments, customers and invoices will be permanently deleted.
            </div>
          </div>
          <button
            className="btn"
            style={{
              borderColor: "hsl(var(--danger))",
              color: "hsl(var(--danger))",
            }}
            disabled
            title="Contact support"
          >
            Delete workspace
          </button>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Members                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function MembersSection({ data }: { data: SettingsData }) {
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "admins" | "drivers" | "pending">("all");

  const allRows = React.useMemo(() => {
    const active = data.users.map((u) => ({
      id: u.id,
      kind: "active" as const,
      name: u.name ?? u.email,
      email: u.email,
      role: u.role,
      status: u.isActive ? ("active" as const) : ("inactive" as const),
      lastSeen: u.lastSeen ?? "—",
    }));
    const invited = data.invitations.map((i) => ({
      id: i.id,
      kind: "invited" as const,
      name: "(invitation)",
      email: i.email,
      role: i.role,
      status: "invited" as const,
      lastSeen: "Pending",
    }));
    return [...active, ...invited];
  }, [data]);

  const rows = allRows
    .filter((r) =>
      filter === "all"
        ? true
        : filter === "admins"
        ? r.role === "ADMIN"
        : filter === "drivers"
        ? r.role === "DRIVER"
        : r.kind === "invited",
    )
    .filter(
      (r) =>
        r.name.toLowerCase().includes(q.toLowerCase()) ||
        r.email.toLowerCase().includes(q.toLowerCase()),
    );

  const roleCounts = data.users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  const roles = [
    { name: "Admin", code: "ADMIN", perms: "Full access" },
    { name: "Dispatcher", code: "DISPATCHER", perms: "Shipments, fleet, orders" },
    { name: "Accountant", code: "ACCOUNTANT", perms: "Invoices, payments, reports" },
    { name: "Driver", code: "DRIVER", perms: "Mobile only · own trips" },
  ];

  return (
    <>
      <div className="card p-5">
        <SectionHeader
          title="Members"
          desc={`${data.users.filter((u) => u.isActive).length} active member${
            data.users.length === 1 ? "" : "s"
          } · ${data.invitations.length} pending invite${
            data.invitations.length === 1 ? "" : "s"
          }`}
          action={
            <div className="flex items-center gap-2">
              <button className="btn" disabled>
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <InviteUserButton />
            </div>
          }
        />
        <div className="mb-3 flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="text-dim absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2" />
            <input
              className="input pl-8"
              placeholder="Search by name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="seg">
            {(["all", "admins", "drivers", "pending"] as const).map((f) => (
              <button
                key={f}
                className={filter === f ? "on" : ""}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-app">
          <table className="tbl">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold"
                        style={{
                          background:
                            r.kind === "invited"
                              ? "hsl(var(--surface-2))"
                              : "hsl(var(--primary) / 0.12)",
                          color:
                            r.kind === "invited"
                              ? "hsl(var(--text-muted))"
                              : "hsl(var(--primary))",
                        }}
                      >
                        {r.kind === "invited" ? "?" : initials(r.name)}
                      </div>
                      <div>
                        <div className="text-[13px] font-medium">{r.name}</div>
                        <div className="text-dim text-[11.5px]">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="pill">{r.role}</span>
                  </td>
                  <td>
                    {r.status === "active" ? (
                      <span className="pill pill-success">Active</span>
                    ) : r.status === "invited" ? (
                      <span className="pill pill-warning">Invited</span>
                    ) : (
                      <span className="pill">Inactive</span>
                    )}
                  </td>
                  <td className="text-soft num">{r.lastSeen}</td>
                  <td className="pr-4 text-right">
                    <button className="text-dim hover:text-app">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-soft py-8 text-center">
                    No members match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <SectionHeader title="Roles & permissions" desc="Click a role to customize." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((r) => (
            <div
              key={r.code}
              className="card p-4"
              style={{ background: "hsl(var(--surface-2))" }}
            >
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold">{r.name}</div>
                <span className="pill num">{roleCounts[r.code] ?? 0}</span>
              </div>
              <div className="text-soft mt-1 text-[11.5px]">{r.perms}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Branches                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

function BranchesSection({ data }: { data: SettingsData }) {
  return (
    <div className="card p-5">
      <SectionHeader
        title="Branches"
        desc="Your physical locations and customs yards."
        action={<NewBranchButton />}
      />
      {data.branches.length === 0 ? (
        <div className="text-soft py-8 text-center text-[12.5px]">
          You haven&apos;t added any branches yet. Click &ldquo;New branch&rdquo; to get started.
        </div>
      ) : (
        <div className="grid gap-3">
          {data.branches.map((b, idx) => (
            <div
              key={b.id}
              className="card flex items-center gap-4 p-4"
              style={{ background: "hsl(var(--surface-2))" }}
            >
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{
                  background: "hsl(var(--primary) / 0.12)",
                  color: "hsl(var(--primary))",
                }}
              >
                <Pin className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[13.5px] font-semibold">{b.name}</div>
                  {idx === 0 && <span className="pill pill-primary">Primary</span>}
                </div>
                <div className="text-soft text-[11.5px]">
                  {[b.city, b.country].filter(Boolean).join(", ") || "Location not set"}
                  {b.phone && (
                    <>
                      {" · "}
                      <span className="font-mono">{b.phone}</span>
                    </>
                  )}
                </div>
              </div>
              {(b.drivers !== undefined || b.vehicles !== undefined) && (
                <div className="hidden items-center gap-5 text-right sm:flex">
                  {b.drivers !== undefined && (
                    <div>
                      <div className="num text-[15px] font-semibold">{b.drivers}</div>
                      <div className="text-dim text-[10px] uppercase tracking-wider">
                        Drivers
                      </div>
                    </div>
                  )}
                  {b.vehicles !== undefined && (
                    <div>
                      <div className="num text-[15px] font-semibold">{b.vehicles}</div>
                      <div className="text-dim text-[10px] uppercase tracking-wider">
                        Vehicles
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button className="text-dim hover:text-app">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Appearance                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

function AppearanceSection() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const current = mounted ? theme ?? "system" : "system";

  const themes = [
    {
      id: "light",
      label: "Warm Paper",
      desc: "Light",
      bg: "hsl(60 22% 97%)",
      surf: "hsl(60 14% 99%)",
      border: "hsl(60 12% 86%)",
    },
    {
      id: "dark",
      label: "Cool Night",
      desc: "Dark",
      bg: "hsl(234 26% 10%)",
      surf: "hsl(234 22% 14%)",
      border: "hsl(234 16% 26%)",
    },
    {
      id: "system",
      label: "System",
      desc: "Match OS",
      bg: "linear-gradient(135deg, hsl(60 22% 97%) 50%, hsl(234 26% 10%) 50%)",
      surf: "hsl(var(--surface))",
      border: "hsl(var(--border))",
    },
  ];

  return (
    <div className="card p-5">
      <SectionHeader title="Appearance" desc="Theme & typography for everyone in this workspace." />
      <div className="grid gap-5">
        <div>
          <label className="text-[12px] font-medium">Theme</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {themes.map((t) => {
              const active = current === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className="card p-3 text-left transition"
                  style={{
                    borderColor: active ? "hsl(var(--primary))" : "hsl(var(--border))",
                    boxShadow: active ? "0 0 0 3px hsl(var(--primary) / 0.16)" : undefined,
                  }}
                >
                  <div
                    className="mb-2 h-16 rounded-lg"
                    style={{ background: t.bg, border: `1px solid ${t.border}` }}
                  >
                    <div
                      className="m-2 h-3 w-1/2 rounded"
                      style={{ background: t.surf }}
                    />
                    <div
                      className="mx-2 h-2 w-3/4 rounded"
                      style={{ background: "hsl(var(--border-soft))" }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[12.5px] font-medium">{t.label}</div>
                    {active && (
                      <Check
                        className="h-3 w-3"
                        style={{ color: "hsl(var(--primary))" }}
                        strokeWidth={3}
                      />
                    )}
                  </div>
                  <div className="text-dim text-[11px]">{t.desc}</div>
                </button>
              );
            })}
          </div>
          {mounted && (
            <div className="text-dim mt-2 text-[11px]">
              Resolved: <span className="font-mono">{resolvedTheme}</span>
            </div>
          )}
        </div>
        <div>
          <label className="text-[12px] font-medium">Typography</label>
          <div className="card mt-2 p-4">
            <div className="text-dim text-[11px] uppercase tracking-wider">Sans · UI</div>
            <div className="font-display mt-1 text-[20px]">Inter Tight — The quick brown fox</div>
            <div className="divider my-3" />
            <div className="text-dim text-[11px] uppercase tracking-wider">Mono · Numerics</div>
            <div className="font-mono num mt-1 text-[16px]">
              JetBrains Mono · 1,234,567.89 · GE-405123456
            </div>
          </div>
        </div>
        <div>
          <label className="text-[12px] font-medium">Density</label>
          <div className="seg mt-2">
            <button>Compact</button>
            <button className="on">Comfortable</button>
            <button>Spacious</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Notifications                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

type NotifRow = { label: string; desc: string; email: boolean; push: boolean; sms: boolean };
type NotifGroup = { title: string; rows: NotifRow[] };

function NotificationsSection() {
  const [groups, setGroups] = React.useState<NotifGroup[]>([
    {
      title: "Shipments",
      rows: [
        { label: "New shipment created", desc: "When dispatch creates a shipment", email: true, push: true, sms: false },
        { label: "Status change", desc: "Assigned, picked up, delivered", email: false, push: true, sms: false },
        { label: "Delay detected", desc: "Auto-detected from tracking telemetry", email: true, push: true, sms: true },
      ],
    },
    {
      title: "Finance",
      rows: [
        { label: "Invoice paid", desc: "Customer payment received", email: true, push: true, sms: false },
        { label: "Invoice overdue", desc: "More than 7 days late", email: true, push: false, sms: false },
      ],
    },
    {
      title: "Fleet",
      rows: [
        { label: "Maintenance due", desc: "Vehicle service approaching", email: true, push: false, sms: false },
      ],
    },
  ]);

  function toggle(gIdx: number, rIdx: number, ch: "email" | "push" | "sms") {
    setGroups((g) =>
      g.map((grp, i) =>
        i !== gIdx
          ? grp
          : {
              ...grp,
              rows: grp.rows.map((r, j) =>
                j !== rIdx ? r : { ...r, [ch]: !r[ch] },
              ),
            },
      ),
    );
  }

  return (
    <div className="card p-5">
      <SectionHeader title="Notifications" desc="Choose what you'd like to be notified about." />
      <div className="overflow-hidden rounded-xl border border-app">
        <div className="surface-2 grid grid-cols-[1fr_72px_72px_72px] border-b border-app px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-dim">
          <span>Event</span>
          <span className="text-center">Email</span>
          <span className="text-center">Push</span>
          <span className="text-center">SMS</span>
        </div>
        {groups.map((g, gi) => (
          <div key={gi}>
            <div className="surface-2 border-b border-app px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-soft">
              {g.title}
            </div>
            {g.rows.map((r, ri) => (
              <div
                key={ri}
                className="grid grid-cols-[1fr_72px_72px_72px] items-center border-b px-4 py-3"
                style={{ borderColor: "hsl(var(--border-soft))" }}
              >
                <div>
                  <div className="text-[13px] font-medium">{r.label}</div>
                  <div className="text-dim text-[11.5px]">{r.desc}</div>
                </div>
                {(["email", "push", "sms"] as const).map((ch) => (
                  <div key={ch} className="grid place-items-center">
                    <button
                      type="button"
                      className={`switch ${r[ch] ? "on" : ""}`}
                      onClick={() => toggle(gi, ri, ch)}
                      aria-label={`${r.label} ${ch}`}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="text-dim mt-3 text-[11px]">
        Note: notification preferences UI is wired locally — backend persistence ships in the next release.
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Billing                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function BillingSection({ data }: { data: SettingsData }) {
  return (
    <>
      <div
        className="card p-5"
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary) / 0.1), transparent)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="pill pill-primary">Current plan</span>
            <div className="big-num mt-2 text-[26px]">Growth</div>
            <div className="text-soft mt-1 text-[12.5px]">
              Up to 50 vehicles · unlimited shipments · 12 members included
            </div>
          </div>
          <div className="text-right">
            <div className="big-num text-[26px]">
              $249<span className="text-dim text-[14px] font-normal">/mo</span>
            </div>
            <div className="text-dim text-[11.5px]">Renews monthly</div>
          </div>
        </div>
        <div className="divider my-4" />
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Vehicles" v={`${data.counts.vehicles} / 50`} />
          <Stat label="Members" v={`${data.counts.members} / 12`} />
          <Stat
            label="Shipments / mo"
            v={data.counts.shipmentsThisMonth.toLocaleString()}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary" disabled>
            Upgrade plan
          </button>
          <button className="btn" disabled>
            Compare plans
          </button>
        </div>
      </div>
      <div className="card p-5">
        <SectionHeader title="Billing history" desc="Mock data — wired to Stripe in v2." />
        <div className="text-soft py-6 text-center text-[12.5px]">
          No billing history available.
        </div>
      </div>
    </>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div className="text-dim text-[10.5px] uppercase tracking-wider">{label}</div>
      <div className="num mt-0.5 text-[16px] font-semibold">{v}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Integrations                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

function IntegrationsSection({ data }: { data: SettingsData }) {
  const items = [
    { name: "Mapbox", desc: "Maps & routing", key: "mapbox", color: "primary", icon: MapIcon },
    { name: "Twilio", desc: "SMS notifications", key: "twilio", color: "danger", icon: Bell },
    { name: "Resend", desc: "Transactional email", key: "resend", color: "success", icon: FileText },
    { name: "Stripe", desc: "Customer payments", key: "stripe", color: "primary", icon: CreditCard },
    { name: "QuickBooks", desc: "Accounting sync", key: "quickbooks", color: "success", icon: FileText },
    { name: "Slack", desc: "Team notifications", key: "slack", color: "warning", icon: Bell },
  ] as const;

  return (
    <div className="card p-5">
      <SectionHeader title="Integrations" desc="Connect external services to extend your workspace." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => {
          const connected = Boolean(data.integrations[i.key]);
          return (
            <div key={i.name} className="card p-4">
              <div className="flex items-start justify-between">
                <div
                  className="grid h-9 w-9 place-items-center rounded-xl"
                  style={{
                    background: `hsl(var(--${i.color}) / 0.14)`,
                    color: `hsl(var(--${i.color}))`,
                  }}
                >
                  <i.icon className="h-4 w-4" />
                </div>
                {connected ? (
                  <span className="pill pill-success">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    Connected
                  </span>
                ) : (
                  <span className="pill">Not connected</span>
                )}
              </div>
              <div className="mt-3 text-[13.5px] font-semibold">{i.name}</div>
              <div className="text-soft mt-0.5 text-[12px]">{i.desc}</div>
              <button className="btn mt-3 w-full justify-center" disabled>
                {connected ? "Configure" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Security                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

function SecuritySection() {
  const [auth2fa, set2fa] = React.useState(false);
  const [sso, setSso] = React.useState(false);
  const [trusted, setTrusted] = React.useState(false);

  const sessions = [
    { dev: "This device · Chrome", loc: "—", current: true, last: "Now" },
  ];

  return (
    <>
      <div className="card p-5">
        <SectionHeader title="Authentication" />
        <div className="space-y-3">
          {[
            { label: "Two-factor authentication", desc: "Require a second factor for all admins", on: auth2fa, set: set2fa },
            { label: "Single sign-on (SAML)", desc: "Enterprise SSO via your identity provider", on: sso, set: setSso },
            { label: "Trusted devices only", desc: "Block sign-ins from unknown devices", on: trusted, set: setTrusted },
          ].map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between rounded-xl p-3"
              style={{ background: "hsl(var(--surface-2))" }}
            >
              <div>
                <div className="text-[13px] font-medium">{r.label}</div>
                <div className="text-soft text-[11.5px]">{r.desc}</div>
              </div>
              <button
                type="button"
                className={`switch ${r.on ? "on" : ""}`}
                onClick={() => r.set(!r.on)}
                aria-label={r.label}
              />
            </div>
          ))}
        </div>
        <div className="text-dim mt-3 text-[11px]">
          Note: security UI is wired locally — server enforcement ships in the next release.
        </div>
      </div>
      <div className="card p-5">
        <SectionHeader title="Active sessions" />
        <div className="space-y-2">
          {sessions.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-app p-3"
            >
              <div
                className="grid h-8 w-8 place-items-center rounded-lg"
                style={{ background: "hsl(var(--surface-2))", color: "hsl(var(--text-muted))" }}
              >
                <Eye className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  {s.dev}
                  {s.current && <span className="pill pill-success">This device</span>}
                </div>
                <div className="text-dim font-mono text-[11.5px]">
                  {s.loc} · {s.last}
                </div>
              </div>
              {!s.current && (
                <button
                  className="btn btn-ghost"
                  style={{ color: "hsl(var(--danger))" }}
                >
                  Sign out
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
