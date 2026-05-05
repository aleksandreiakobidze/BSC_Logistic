import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getUploadUrl, isStorageConfigured } from "@/lib/storage";

const schema = z.object({
  key: z.string().min(1),
  contentType: z.string().default("application/octet-stream"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Bad payload" }, { status: 400 });

  if (!isStorageConfigured()) {
    return NextResponse.json({ mock: true, key: parsed.data.key });
  }

  const url = await getUploadUrl(parsed.data.key, parsed.data.contentType);
  return NextResponse.json({ url, key: parsed.data.key });
}
