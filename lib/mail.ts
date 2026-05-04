import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outbound email transport.
 *
 * Resolution order (first match wins):
 *   1. SMTP — when `SMTP_HOST` is set we build a Nodemailer transporter.
 *      Designed for Gmail SMTP (smtp.gmail.com:587, App Password) but works
 *      with any standard SMTP server.
 *   2. Resend — when `RESEND_API_KEY` is set, use the Resend HTTPS API.
 *   3. Mock — log to console and return `{ mocked: true }` so dev environments
 *      without credentials don't crash.
 *
 * The "from" address is read from `MAIL_FROM` (preferred) or `EMAIL_FROM`
 * (legacy / Resend default).
 */

const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

let smtpTransport: Transporter | null = null;

function getSmtpTransport(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (smtpTransport) return smtpTransport;
  const port = Number(process.env.SMTP_PORT ?? 587);
  smtpTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // Implicit TLS on 465; STARTTLS otherwise (Gmail uses 587 + STARTTLS).
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });
  return smtpTransport;
}

function defaultFrom(): string {
  return (
    process.env.MAIL_FROM ??
    process.env.EMAIL_FROM ??
    "BSC Logistics <noreply@example.com>"
  );
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  text?: string;
}) {
  const from = params.from ?? defaultFrom();

  const smtp = getSmtpTransport();
  if (smtp) {
    const info = await smtp.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return { id: info.messageId ?? "", mocked: false as const };
  }

  if (resend) {
    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) throw new Error(error.message);
    return { id: data?.id ?? "", mocked: false as const };
  }

  console.log("[mail] (mock) to=%s subject=%s", params.to, params.subject);
  return { id: "mock", mocked: true as const };
}
