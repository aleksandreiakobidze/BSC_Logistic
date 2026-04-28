import twilio from "twilio";

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_FROM_NUMBER;

export const twilioClient = sid && token ? twilio(sid, token) : null;

export async function sendSMS(params: { to: string; body: string }) {
  if (!twilioClient || !from) {
    console.log("[sms] (mock) to=%s body=%s", params.to, params.body);
    return { sid: "mock", mocked: true as const };
  }
  const msg = await twilioClient.messages.create({
    from,
    to: params.to,
    body: params.body,
  });
  return { sid: msg.sid, mocked: false as const };
}
