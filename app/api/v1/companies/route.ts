import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, created, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";
import { z } from "zod";
import bcrypt from "bcryptjs";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.string().min(1),
  adminName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPhone: z.string().min(1, "Managing director phone number is required"),
  adminPassword: z.string().min(8),
});

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden();

    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, customers: true, loans: true } },
        loans: {
          where: { status: { in: ["active", "overdue"] } },
          select: { balanceOutstanding: true },
        },
      },
    });

    const data = companies.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      status: c.status,
      createdAt: c.createdAt,
      employeeCount: c._count.users,
      activeLoans: c._count.loans,
      totalPortfolio: c.loans.reduce((s, l) => s + l.balanceOutstanding, 0),
    }));

    return ok(data);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden("Only super admins can create companies.");

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const hashedPassword = await bcrypt.hash(parsed.data.adminPassword, 12);

    const company = await prisma.company.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        address: parsed.data.address,
        users: {
          create: {
            name: parsed.data.adminName,
            email: parsed.data.adminEmail,
            phone: parsed.data.adminPhone,
            password: hashedPassword,
            role: "managing_director",
          },
        },
      },
      include: { users: { select: { id: true, name: true, email: true, role: true } } },
    });

    return created(company);
  } catch (e: any) {
    if (e?.code === "P2002") return badRequest("A company or user with that email already exists.");
    console.error(e);
    return serverError();
  }
}
