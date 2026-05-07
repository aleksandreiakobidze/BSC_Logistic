"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  KeyRound,
  ShieldCheck,
  UserPlus,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCustomerPortalUser,
  resetCustomerPortalPassword,
  updateCustomerPortalUser,
} from "../portal-actions";

export type PortalUserSummary = {
  id: string;
  email: string;
  name: string | null;
  lastLoginAt: Date | string | null;
} | null;

export function PortalAccessCard({
  customerId,
  customerName,
  defaultEmail,
  portalUser,
}: {
  customerId: string;
  customerName: string;
  defaultEmail?: string | null;
  portalUser: PortalUserSummary;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [reset, setReset] = React.useState(false);
  const [editLogin, setEditLogin] = React.useState(false);

  function k(key: string, fallback: string): string {
    try {
      const v = t(`customers.portalAccess.${key}` as never);
      if (v && !v.startsWith("customers.portalAccess.")) return v;
    } catch {}
    return fallback;
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const name = String(fd.get("name") ?? "").trim();
    setBusy(true);
    try {
      const res = await createCustomerPortalUser({
        customerId,
        email,
        password,
        name: name || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(k("createdToast", "Portal access created"));
      form.reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!portalUser) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const password = String(fd.get("password") ?? "");
    setBusy(true);
    try {
      const res = await resetCustomerPortalPassword({
        userId: portalUser.id,
        password,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(k("resetToast", "Password updated"));
      form.reset();
      setReset(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function onEditLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!portalUser) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();
    const name = String(fd.get("name") ?? "").trim();
    if (!email) return;
    setBusy(true);
    try {
      const res = await updateCustomerPortalUser({
        userId: portalUser.id,
        email,
        name: name || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(k("loginUpdated", "Login updated"));
      setEditLogin(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          {k("title", "Portal access")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {portalUser ? (
          <>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {k("loginEmail", "Login email")}
              </div>
              <div className="font-mono text-sm break-all">{portalUser.email}</div>
              {portalUser.lastLoginAt && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {k("lastLogin", "Last login")}:{" "}
                  {new Date(portalUser.lastLoginAt).toLocaleString()}
                </div>
              )}
            </div>
            {editLogin ? (
              <form
                key={portalUser.id}
                onSubmit={onEditLogin}
                className="space-y-2"
              >
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {k("loginEmail", "Login email")}
                  </Label>
                  <Input
                    name="email"
                    type="email"
                    required
                    defaultValue={portalUser.email}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {k("name", "Display name")}
                  </Label>
                  <Input
                    name="name"
                    defaultValue={portalUser.name ?? ""}
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => setEditLogin(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" size="sm" className="flex-1" disabled={busy}>
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {k("save", "Save")}
                  </Button>
                </div>
              </form>
            ) : reset ? (
              <form onSubmit={onReset} className="space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {k("newPassword", "New password")}
                  </Label>
                  <Input
                    name="password"
                    type="password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => setReset(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" size="sm" className="flex-1" disabled={busy}>
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {k("save", "Save")}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => setEditLogin(true)}
                >
                  <Pencil className="h-4 w-4" />
                  {k("editLogin", "Edit login")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => setReset(true)}
                >
                  <KeyRound className="h-4 w-4" />
                  {k("resetPassword", "Reset password")}
                </Button>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={onCreate} className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {k(
                "intro",
                "Create a login so the customer can review quotations and respond from the portal.",
              )}
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">{k("loginEmail", "Login email")}</Label>
              <Input
                name="email"
                type="email"
                required
                defaultValue={defaultEmail ?? ""}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{k("name", "Display name")}</Label>
              <Input
                name="name"
                defaultValue={customerName}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {k("initialPassword", "Initial password")}
              </Label>
              <Input
                name="password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
              <p className="text-[11px] text-muted-foreground">
                {k(
                  "passwordHint",
                  "Share this with the customer privately; they can change it later.",
                )}
              </p>
            </div>
            <Button type="submit" className="w-full justify-center gap-2" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {k("createButton", "Create portal access")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
