import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { created, paginated, unauthorized, badRequest, forbidden, notFound, serverError } from "@/lib/api-response";
import { z } from "zod";

const createSchema = z.object({
  loanId: z.string(),
  amount: z.number().positive(),
  method: z.enum(["cash", "bank_transfer", "mobile_money"]),
  reference: z.string().min(1),
  notes: z.string().optional(),
  date: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Number(searchParams.get("limit") ?? 20));
    const search = searchParams.get("search") ?? "";
    const skip = (page - 1) * limit;

    const where = {
      companyId: auth.companyId,
      ...(search && {
        OR: [
          { customer: { names: { contains: search } } },
          { reference: { contains: search } },
        ],
      }),
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: limit,
        include: {
          customer: { select: { names: true } },
          recordedBy: { select: { name: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    const data = payments.map((p) => ({
      ...p,
      customerName: p.customer.names,
      recordedByName: p.recordedBy.name,
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

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const loan = await prisma.loan.findFirst({
      where: { id: parsed.data.loanId, companyId: auth.companyId },
    });
    if (!loan) return notFound("Loan not found.");
    if (!["active", "overdue", "disbursed"].includes(loan.status)) {
      return badRequest("Payments can only be recorded on active or overdue loans.");
    }

    const { amount, loanId, method, reference, notes, date } = parsed.data;

    // Auto-allocate: penalty → interest → principal
    let remaining = amount;
    const penaltyPaid = Math.min(remaining, loan.penaltyAmount);
    remaining -= penaltyPaid;

    const rate = Number(loan.interestRate) / 100;
    const interest = Math.min(remaining, Math.round(loan.outstandingBalance * rate));
    remaining -= interest;

    const principal = remaining;
    const newOutstanding = Math.max(0, loan.outstandingBalance - principal);
    const newPaidInstallments = loan.paidInstallments + 1;
    const isFullyPaid = newOutstanding === 0;

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          loanId,
          customerId: loan.customerId,
          amount,
          penalty: penaltyPaid,
          interest,
          principal,
          date: date ? new Date(date) : new Date(),
          method,
          reference,
          notes,
          recordedById: auth.userId,
          companyId: auth.companyId,
        },
      });

      await tx.loan.update({
        where: { id: loanId },
        data: {
          totalPaid: loan.totalPaid + amount,
          outstandingBalance: newOutstanding,
          penaltyAmount: loan.penaltyAmount - penaltyPaid,
          paidInstallments: newPaidInstallments,
          status: isFullyPaid ? "completed" : "active",
        },
      });

      return p;
    });

    return created(payment);
  } catch (e: any) {
    if (e?.code === "P2002") return badRequest("A payment with this reference already exists.");
    console.error(e);
    return serverError();
  }
}
