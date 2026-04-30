import { NextResponse } from "next/server";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { InvoicePDF } from "@/components/app/invoice-pdf";
import { parseTemplate } from "@/lib/invoice-template";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const invoice = await prisma.invoice.findFirst({
    where: {
      id,
      OR: [
        { orgId: session.user.orgId ?? undefined },
        { customerId: session.user.customerId ?? undefined },
      ],
    },
    include: {
      customer: true,
      organization: { select: { name: true, invoiceTemplate: true } },
      lines: true,
      order: true,
      payments: { orderBy: { paidAt: "asc" } },
    },
  });
  if (!invoice) return new NextResponse("Not found", { status: 404 });

  const template = parseTemplate(invoice.organization.invoiceTemplate);

  const stream = (await renderToStream(
    React.createElement(InvoicePDF, { invoice, template }) as React.ReactElement,
  )) as unknown as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.number}.pdf"`,
    },
  });
}
