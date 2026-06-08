/**
 * Centralised environment validation. Imported once at process start (from
 * `instrumentation.ts`) so a misconfigured deploy crashes immediately with a
 * loud zod error instead of failing later with a cryptic "DATABASE_URL is
 * undefined" deep inside Prisma.
 *
 * Add new env vars here as they appear in code; `optional()` for non-essential
 * ones, plain validators for the must-have list.
 */

import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";
// Skip strict validation when running `next build` in CI, where Vercel-style
// build-time env stubs are placeholders.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const required = (label: string) =>
  z
    .string({
      required_error: `Missing required env var: ${label}`,
      invalid_type_error: `${label} must be a string`,
    })
    .min(1, `${label} cannot be empty`);

const databaseUrl = required("DATABASE_URL")
  .refine(
    (v) => v.startsWith("postgresql://") || v.startsWith("postgres://") || v.startsWith("file:"),
    "DATABASE_URL must be a postgres:// or file:// URL",
  );

const schema = z.object({
  // Core
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: databaseUrl,
  NEXTAUTH_SECRET: required("NEXTAUTH_SECRET"),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  MAIL_FROM: z.string().email().optional(),

  // Background fan-out (required for multi-replica SSE; falls back to
  // EventEmitter when absent so dev still works).
  REDIS_URL: z.string().optional(),

  // Storage (required in prod for uploads; dev can fall back to disk).
  AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),
  AZURE_STORAGE_CONTAINER: z.string().optional().default("uploads"),
  AZURE_STORAGE_PUBLIC_URL: z.string().url().optional(),

  // Email (Resend preferred, SMTP fallback).
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // SMS
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  // Public client config
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),

  // Observability
  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().optional(),

  // Inbound quote-request mailbox
  QUOTE_INBOX: z.string().email().optional(),

  // External tracking (AfterShip)
  AFTERSHIP_API_KEY: z.string().optional(),
  AFTERSHIP_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const lines = Object.entries(flat).map(
      ([k, v]) => `  • ${k}: ${(v ?? []).join(", ")}`,
    );
    const msg =
      "Environment validation failed:\n" + lines.join("\n");
    if (isProd && !isBuildPhase) {
      // Crash early in production runtime so the orchestrator restarts the
      // pod with a useful log line, instead of half-running with bad config.
      throw new Error(msg);
    } else {
      console.warn(`[env] ${msg}`);
    }
  }
  cached = (parsed.success ? parsed.data : (process.env as unknown as Env));
  return cached;
}

/**
 * Eagerly validate at import time. `instrumentation.ts` calls this once on
 * server boot so failures surface during container startup, before traffic.
 */
export function assertEnvAtBoot(): void {
  if (!isBuildPhase) getEnv();
}
