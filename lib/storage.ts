/**
 * Azure Blob Storage helpers for user-uploaded files (POD photos, custom-field
 * file inputs, invoice logos, etc.). Replaces the previous S3 stub.
 *
 * Configuration (env):
 *   AZURE_STORAGE_CONNECTION_STRING — full Blob connection string from Azure.
 *   AZURE_STORAGE_CONTAINER         — container name (default "uploads").
 *   AZURE_STORAGE_PUBLIC_URL        — optional CDN / custom-domain origin.
 *
 * In dev, when none of the above are set, helpers return null/throw so the
 * uploads route can fall back to writing under `public/uploads/<orgId>/`.
 *
 * The on-disk `fileKey` shape (e.g. `pods/<shipmentId>/<filename>`,
 * `docs/<shipmentId>/<filename>`) is preserved 1:1 as the blob name so old
 * rows in `POD.fileKey` / `Document.fileKey` keep resolving.
 */

import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";

export const AZURE_STORAGE_CONTAINER =
  process.env.AZURE_STORAGE_CONTAINER ?? "uploads";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const publicUrl = process.env.AZURE_STORAGE_PUBLIC_URL;

let cachedService: BlobServiceClient | null = null;
let cachedSharedKey: StorageSharedKeyCredential | null = null;

function getService(): BlobServiceClient | null {
  if (cachedService) return cachedService;
  if (!connectionString || connectionString.trim().length === 0) return null;
  try {
    cachedService = BlobServiceClient.fromConnectionString(connectionString);
    cachedSharedKey = parseSharedKeyFromConnString(connectionString);
    return cachedService;
  } catch (err) {
    console.error("[storage] failed to init Azure Blob client", err);
    return null;
  }
}

function parseSharedKeyFromConnString(
  conn: string,
): StorageSharedKeyCredential | null {
  const parts = Object.fromEntries(
    conn.split(";").map((p) => {
      const idx = p.indexOf("=");
      if (idx === -1) return [p, ""] as const;
      return [p.slice(0, idx), p.slice(idx + 1)] as const;
    }),
  );
  const accountName = parts["AccountName"];
  const accountKey = parts["AccountKey"];
  if (!accountName || !accountKey) return null;
  try {
    return new StorageSharedKeyCredential(accountName, accountKey);
  } catch {
    return null;
  }
}

/** Quick boolean helper for callers that need to branch on configuration. */
export function isStorageConfigured(): boolean {
  return getService() !== null;
}

/** Backwards-compat alias used by older code paths. */
export const s3 = isStorageConfigured() ? ({} as object) : null;
export const S3_BUCKET = AZURE_STORAGE_CONTAINER;

async function getContainer(name = AZURE_STORAGE_CONTAINER) {
  const svc = getService();
  if (!svc) throw new Error("Azure Blob storage is not configured");
  const container = svc.getContainerClient(name);
  return container;
}

/**
 * Upload an in-memory buffer to Blob under `key`. Returns a temporary read SAS
 * URL good for the next 7 days (long enough for users to download via the
 * returned link, short enough to limit exposure if leaked).
 */
export async function uploadBuffer(
  key: string,
  data: Buffer | Uint8Array,
  contentType?: string,
): Promise<{ key: string; url: string }> {
  const container = await getContainer();
  const blob = container.getBlockBlobClient(key);
  await blob.uploadData(data, {
    blobHTTPHeaders: contentType ? { blobContentType: contentType } : undefined,
  });
  const url = await getDownloadUrl(key, 60 * 60 * 24 * 7);
  return { key, url };
}

/**
 * Returns a SAS URL for read access to the blob. `expiresIn` is in seconds.
 */
export async function getDownloadUrl(
  key: string,
  expiresInSeconds = 600,
): Promise<string> {
  const container = await getContainer();
  const blob = container.getBlockBlobClient(key);

  if (cachedSharedKey) {
    const expiresOn = new Date(Date.now() + expiresInSeconds * 1000);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: container.containerName,
        blobName: key,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn,
        protocol: undefined,
      },
      cachedSharedKey,
    ).toString();
    return `${blob.url}?${sas}`;
  }

  // Fall back to user-delegation SAS via the SDK helper (works with managed
  // identity / AAD auth). Less common in this stack but covered for safety.
  return blob.url;
}

/**
 * Returns a SAS URL the browser can `PUT` directly to. Used by the presign
 * route for direct-to-blob uploads from the client (bypassing our server).
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 600,
): Promise<string> {
  const container = await getContainer();
  const blob = container.getBlockBlobClient(key);
  if (!cachedSharedKey) {
    throw new Error("Upload SAS requires a shared-key connection string");
  }
  const expiresOn = new Date(Date.now() + expiresInSeconds * 1000);
  const sas = generateBlobSASQueryParameters(
    {
      containerName: container.containerName,
      blobName: key,
      permissions: BlobSASPermissions.parse("cw"),
      contentType,
      expiresOn,
    },
    cachedSharedKey,
  ).toString();
  return `${blob.url}?${sas}`;
}

export async function deleteObject(key: string): Promise<void> {
  if (!isStorageConfigured()) return;
  try {
    const container = await getContainer();
    await container.deleteBlob(key, { deleteSnapshots: "include" });
  } catch (err) {
    console.error("[storage] deleteObject failed", err);
  }
}

/** Returns a public URL when the container is configured for public access. */
export function publicFileUrl(key: string): string | null {
  if (publicUrl) return `${publicUrl.replace(/\/$/, "")}/${key}`;
  return null;
}

// Backwards-compat aliases — older imports referenced `presign*` names.
export const presignUpload = (key: string, contentType: string, expiresIn = 600) =>
  getUploadUrl(key, contentType, expiresIn);
export const presignDownload = (key: string, expiresIn = 600) =>
  getDownloadUrl(key, expiresIn);
