import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mail";

export async function POST(req: Request) {
  const fd = await req.formData();
  const payload = Object.fromEntries(fd.entries());
  const recipient = process.env.QUOTE_INBOX ?? "dispatch@example.com";
  try {
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
    return NextResponse.json({ ok: true, emailSent: true });
  } catch (err) {
    // Don't 500 the public form on transport errors — log and tell the
    // caller their submission was received but the notification email
    // didn't go out. The marketing site can decide how to surface that.
    console.error("[quote-requests] mail transport failed", err);
    return NextResponse.json(
      {
        ok: true,
        emailSent: false,
        emailError:
          err instanceof Error ? err.message : "Email transport failed",
      },
      { status: 200 },
    );
  }
}
