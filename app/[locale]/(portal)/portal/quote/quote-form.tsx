"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function QuoteForm() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fetch("/api/quote-requests", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Failed to submit");
      toast.success("Quote request sent!");
      router.push("/portal");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Your name</Label>
              <Input name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input name="phone" />
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input name="company" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Pickup address</Label>
              <Input name="pickup" required />
            </div>
            <div className="space-y-1.5">
              <Label>Dropoff address</Label>
              <Input name="dropoff" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cargo details</Label>
            <Textarea name="cargo" rows={4} placeholder="Weight, volume, special handling..." />
          </div>
          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send request
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
