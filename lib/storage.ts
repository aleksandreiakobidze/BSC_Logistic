import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION ?? "auto";
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
export const S3_BUCKET = process.env.S3_BUCKET ?? "bsc-logistics";
const publicUrl = process.env.S3_PUBLIC_URL;

export const s3 =
  accessKeyId && secretAccessKey
    ? new S3Client({
        region,
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: !!endpoint,
      })
    : null;

export async function presignUpload(key: string, contentType: string, expiresIn = 600) {
  if (!s3) throw new Error("S3 is not configured");
  const cmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(s3, cmd, { expiresIn });
}

export async function presignDownload(key: string, expiresIn = 600) {
  if (!s3) throw new Error("S3 is not configured");
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
}

export async function deleteObject(key: string) {
  if (!s3) return;
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}

export function publicFileUrl(key: string) {
  if (publicUrl) return `${publicUrl.replace(/\/$/, "")}/${key}`;
  return null;
}
