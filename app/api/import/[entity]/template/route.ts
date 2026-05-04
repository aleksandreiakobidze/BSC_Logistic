import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildTemplate, xlsxResponse } from "@/lib/excel";
import {
  getEffectiveFields,
  importEntitySlugs,
  type ImportEntitySlug,
} from "@/lib/import/registry";

/**
 * GET /api/import/[entity]/template
 *
 * Streams a freshly-generated .xlsx template containing one column per
 * effective field for the org (built-in + custom). Required column labels
 * are suffixed with " *" so users see the obligation in Excel.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const orgId = session.user.orgId;

  const { entity } = await params;
  if (!importEntitySlugs.includes(entity as ImportEntitySlug)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const slug = entity as ImportEntitySlug;

  const fields = await getEffectiveFields(orgId, slug);
  const headers = fields.map((f) => ({
    key: f.key,
    label: f.required ? `${f.label} *` : f.label,
    example: f.example,
  }));

  const wb = buildTemplate(headers, slug);
  return xlsxResponse(wb, `${slug}-import-template`);
}
