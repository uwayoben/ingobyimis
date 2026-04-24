import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { created, paginated, unauthorized, badRequest, forbidden, serverError } from "@/lib/api-response";
import { z } from "zod";

const createSchema = z.object({
  customerId: z.string(),
  amount: z.number().positive(),
  interestRate: z.number().positive(),
  interestType: z.enum(["flat", "declining"]),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly"]),
  installments: z.number().int().positive(),
  purpose: z.string().min(1),
  dueDate: z.string(),
  fees: z.array(z.object({
    name: z.string(),
    type: z.enum(["fixed", "percentage"]),
    value: z.number(),
    isRecurring: z.boolean().optional(),
  })).optional(),
});

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Number(searchParams.get("limit") ?? 20));
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");
    const skip = (page - 1) * limit;

    const where = {
      companyId: auth.companyId,
      ...(status && status !== "all" && { status: status as any }),
      ...(search && {
        OR: [
          { customer: { names: { contains: search } } },
          { id: { contains: search } },
        ],
      }),
    };

    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          customer: { select: { id: true, names: true } },
          fees: true,
        },
      }),
      prisma.loan.count({ where }),
    ]);

    const data = loans.map((l) => ({
      ...l,
      customerName: l.customer.names,
      interestRate: Number(l.interestRate),
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
    if (!["managing_director", "loan_officer"].includes(auth.role)) return forbidden();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const { fees, dueDate, ...loanData } = parsed.data;

    // Calculate totals
    const rate = loanData.interestRate / 100;
    let totalRepayable: number;
    if (loanData.interestType === "flat") {
      totalRepayable = loanData.amount + loanData.amount * rate * loanData.installments;
    } else {
      const monthlyPayment = (loanData.amount * rate) / (1 - Math.pow(1 + rate, -loanData.installments));
      totalRepayable = Math.round(monthlyPayment * loanData.installments);
    }
    const nextPaymentAmount = Math.round(totalRepayable / loanData.installments);

    const loan = await prisma.loan.create({
      data: {
        ...loanData,
        interestRate: loanData.interestRate,
        dueDate: new Date(dueDate),
        companyId: auth.companyId,
        createdById: auth.userId,
        totalRepayable,
        outstandingBalance: totalRepayable,
        nextPaymentAmount,
        fees: fees?.length
          ? { create: fees.map((f) => ({ name: f.name, type: f.type as any, value: f.value, isRecurring: f.isRecurring ?? false })) }
          : undefined,
      },
      include: { fees: true },
    });

    // Create approval notification
    await prisma.notification.create({
      data: {
        type: "approval_needed",
        title: "New Loan Application",
        message: `A new loan of RWF ${loanData.amount.toLocaleString()} requires approval.`,
        companyId: auth.companyId,
        link: `/loans/${loan.id}`,
      },
    });

    return created(loan);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
