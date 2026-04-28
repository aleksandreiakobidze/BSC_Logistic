import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}) {
  const from = params.from ?? process.env.EMAIL_FROM ?? "BSC Logistics <noreply@example.com>";
  if (!resend) {
    console.log("[mail] (mock) to=%s subject=%s", params.to, params.subject);
    return { id: "mock", mocked: true as const };
  }
  const { data, error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (error) throw new Error(error.message);
  return { id: data?.id ?? "", mocked: false as const };
}
