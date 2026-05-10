import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { created, paginated, unauthorized, badRequest, forbidden, serverError } from "@/lib/api-response";
import { z } from "zod";

const createSchema = z.object({
  names: z.string().min(1),
  nationalId: z.string().min(1),
  dateOfBirth: z.string(),
  gender: z.enum(["Male", "Female"]),
  province: z.string().min(1),
  district: z.string().min(1),
  sector: z.string().min(1),
  cell: z.string().min(1),
  village: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  maritalStatus: z.enum(["Single", "Married", "Divorced", "Widowed"]),
  employerName: z.string().optional(),
  employmentStatus: z.enum(["Employed", "Self-employed", "Unemployed", "Retired"]),
  relationshipWithNdfsp: z.string().optional(),
  spouseName: z.string().optional(),
  spousePhone: z.string().optional(),
  spouseIdNumber: z.string().optional(),
  maritalPropertyRegime: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const isSuperAdmin = auth.role === "super_admin";
    if (!isSuperAdmin && !auth.companyId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 20)));
    const search = searchParams.get("search") ?? "";
    const skip = (page - 1) * limit;

    const where = {
      // super_admin sees all companies; others are scoped to their company
      ...(!isSuperAdmin && { companyId: auth.companyId! }),
      ...(search && {
        OR: [
          { names: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
          { nationalId: { contains: search } },
          { district: { contains: search } },
        ],
      }),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          _count: { select: { loans: true } },
          loans: {
            where: { status: { in: ["active", "overdue"] } },
            select: { balanceOutstanding: true, status: true },
          },
          company: { select: { name: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    const data = customers.map((c) => ({
      id: c.id,
      names: c.names,
      nationalId: c.nationalId,
      dateOfBirth: c.dateOfBirth,
      gender: c.gender,
      province: c.province,
      district: c.district,
      sector: c.sector,
      cell: c.cell,
      village: c.village,
      phone: c.phone,
      email: c.email,
      maritalStatus: c.maritalStatus,
      employerName: c.employerName,
      employmentStatus: c.employmentStatus,
      relationshipWithNdfsp: c.relationshipWithNdfsp,
      isActive: c.isActive,
      companyId: c.companyId,
      companyName: c.company.name,
      createdAt: c.createdAt,
      totalLoans: c._count.loans,
      activeLoans: c.loans.filter((l) => l.status === "active" || l.status === "overdue").length,
      outstandingBalance: c.loans.reduce((s, l) => s + l.balanceOutstanding, 0),
    }));

    return paginated(data, total, page, limit);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "loan_officer", "receptionist"].includes(auth.role)) return forbidden();
    if (!auth.companyId) return forbidden("Company context required.");

    const body = await request.json();
    // Treat empty email as absent
    if (body.email === "") delete body.email;

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const customer = await prisma.customer.create({
      data: {
        ...parsed.data,
        email: parsed.data.email || null,
        dateOfBirth: new Date(parsed.data.dateOfBirth),
        companyId: auth.companyId!,
      },
    });

    return created(customer);
  } catch (e: any) {
    if (e?.code === "P2002") return badRequest("A customer with this National ID already exists.");
    if (e?.code === "P2003") return badRequest("Session is invalid. Please log out and log back in.");
    console.error(e);
    return serverError();
  }
}
