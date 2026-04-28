import { NextResponse } from "next/server";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { InvoicePDF } from "@/components/app/invoice-pdf";

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
      organization: true,
      lines: true,
      order: true,
    },
  });
  if (!invoice) return new NextResponse("Not found", { status: 404 });

  const stream = (await renderToStream(
    React.createElement(InvoicePDF, { invoice }),
  )) as unknown as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.number}.pdf"`,
    },
  });
}
