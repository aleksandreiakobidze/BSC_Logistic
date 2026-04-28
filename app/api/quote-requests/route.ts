import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mail";

export async function POST(req: Request) {
  const fd = await req.formData();
  const payload = Object.fromEntries(fd.entries());
  const recipient = process.env.QUOTE_INBOX ?? "dispatch@example.com";
  await sendEmail({
    to: recipient,
    subject: `New quote request from ${payload.name}`,
    html: `
      <h2>New quote request</h2>
      <ul>
        ${Object.entries(payload)
          .map(([k, v]) => `<li><b>${k}</b>: ${String(v)}</li>`)
          .join("")}
      </ul>
    `,
  });
  return NextResponse.json({ ok: true });
}
