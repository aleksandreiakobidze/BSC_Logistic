import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { auth } from "@/lib/auth";

/**
 * Simple multipart upload endpoint used by custom-field FILE inputs and the
 * invoice designer logo picker. Stores files under `public/uploads/<orgId>/`
 * so they're served back at the same path. For production, swap this body
 * for an S3 PUT (the presigned variant lives at `/api/uploads/presign`).
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

  const dir = path.join(process.cwd(), "public", "uploads", orgId);
  await mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, bytes);

  const publicUrl = `/uploads/${orgId}/${filename}`;
  return NextResponse.json({
    url: publicUrl,
    name: file.name,
    size: file.size,
    type: file.type,
  });
}
