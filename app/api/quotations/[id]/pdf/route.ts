import { NextResponse } from "next/server";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { QuotationPDF } from "@/components/app/quotation-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const quotation = await prisma.quotation.findFirst({
    where: {
      id,
      orgId: session.user.orgId ?? undefined,
    },
    include: {
      customer: true,
      organization: { select: { name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quotation) return new NextResponse("Not found", { status: 404 });

  const stream = (await renderToStream(
    React.createElement(QuotationPDF, {
      quotation,
    }) as React.ReactElement,
  )) as unknown as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quotation-${quotation.number}.pdf"`,
    },
  });
}
