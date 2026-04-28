import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

const url = process.env.REDIS_URL;

export const connection = url
  ? new IORedis(url, { maxRetriesPerRequest: null })
  : null;

export const notificationsQueue = connection
  ? new Queue("notifications", { connection })
  : null;

export async function enqueueNotification(
  channel: "email" | "sms",
  payload: Record<string, unknown>,
) {
  if (!notificationsQueue) {
    console.log("[queue] (mock) %s", channel, payload);
    return;
  }
  await notificationsQueue.add(channel, payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

export const notificationEvents = connection
  ? new QueueEvents("notifications", { connection })
  : null;
