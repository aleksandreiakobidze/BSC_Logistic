import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { sendEmail } from "../lib/mail";
import { sendSMS } from "../lib/sms";

const url = process.env.REDIS_URL;
if (!url) {
  console.log("[worker] REDIS_URL not set — worker running in no-op mode.");
  process.exit(0);
}

const connection = new IORedis(url, { maxRetriesPerRequest: null });

type EmailJob = { to: string; subject: string; html: string; text?: string };
type SmsJob = { to: string; body: string };

const worker = new Worker(
  "notifications",
  async (job: Job) => {
    if (job.name === "email") {
      const { to, subject, html, text } = job.data as EmailJob;
      await sendEmail({ to, subject, html, text });
      return { ok: true };
    }
    if (job.name === "sms") {
      const { to, body } = job.data as SmsJob;
      await sendSMS({ to, body });
      return { ok: true };
    }
    console.warn("[worker] unknown job", job.name);
  },
  { connection, concurrency: 10 },
);

worker.on("completed", (job) => {
  console.log(`[worker] completed ${job.id} (${job.name})`);
});
worker.on("failed", (job, err) => {
  console.error(`[worker] failed ${job?.id} (${job?.name}):`, err.message);
});

console.log("[worker] notifications worker listening…");
