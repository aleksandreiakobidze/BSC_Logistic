import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { audit } from "@/lib/audit";

const schema = z.object({
  orgName: z.string().min(2),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orgName, name, email, password } = schema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ message: "Email already in use" }, { status: 409 });
    }

    const baseSlug = slugify(orgName) || "org";
    let slug = baseSlug;
    let i = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { user, organization } = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: orgName, slug },
      });
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: "ADMIN",
          orgId: organization.id,
          emailVerified: new Date(),
        },
      });
      return { user, organization };
    });

    await audit({
      action: "org.create",
      entity: "Organization",
      entityId: organization.id,
      userId: user.id,
      orgId: organization.id,
      meta: { name: organization.name },
    });

    return NextResponse.json({ ok: true, userId: user.id, orgId: organization.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Invalid input" },
      { status: 400 },
    );
  }
}
