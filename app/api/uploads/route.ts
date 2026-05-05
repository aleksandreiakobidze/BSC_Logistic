import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { isStorageConfigured, uploadBuffer } from "@/lib/storage";

/**
 * Multipart upload endpoint used by custom-field FILE inputs and the invoice
 * designer logo picker.
 *
 * - In production (Azure Blob configured) the file goes straight into the
 *   `uploads` container under the key `org/<orgId>/<filename>`. The returned
 *   `url` is a 7-day read SAS that the browser can use immediately.
 * - In dev (no `AZURE_STORAGE_CONNECTION_STRING`), files fall back to
 *   `public/uploads/<orgId>/<filename>` so the existing local workflow keeps
 *   working without any cloud setup.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 413 });
  }

  const orgId = session.user.orgId;
  const ext = path.extname(file.name).slice(0, 8) || "";
  const safeBase = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(0, 60);
  const id = crypto.randomBytes(8).toString("hex");
  const filename = `${Date.now()}-${id}-${safeBase}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (isStorageConfigured()) {
    const key = `org/${orgId}/${filename}`;
    const { url } = await uploadBuffer(key, bytes, file.type || undefined);
    return NextResponse.json({
      url,
      key,
      name: file.name,
      size: file.size,
      type: file.type,
    });
  }

  // Local dev fallback — ephemeral filesystem; do NOT rely on this in
  // production (ACA replicas don't share disk).
  const dir = path.join(process.cwd(), "public", "uploads", orgId);
  await mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, filename);
  await writeFile(fullPath, bytes);

  const localUrl = `/uploads/${orgId}/${filename}`;
  return NextResponse.json({
    url: localUrl,
    key: localUrl,
    name: file.name,
    size: file.size,
    type: file.type,
  });
}
