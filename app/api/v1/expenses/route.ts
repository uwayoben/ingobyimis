import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, created, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";
import { z } from "zod";

const createSchema = z.object({
  category:    z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  amount:      z.number().int().positive("Amount must be positive"),
  date:        z.string().min(1, "Date is required"),
  isPaid:      z.boolean().optional().default(false),
  proofUrl:    z.string().min(1).optional().or(z.literal("")).transform((v) => v || undefined),
});

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (auth.role === "super_admin") return forbidden("Use company-scoped queries.");

    const expenses = await prisma.expense.findMany({
      where: { companyId: auth.companyId! },
      orderBy: { date: "desc" },
    });

    return ok(expenses);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!auth.companyId) return forbidden();
    if (!["managing_director", "loan_officer"].includes(auth.role)) return forbidden();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const { category, description, amount, date, isPaid, proofUrl } = parsed.data;

    const expense = await prisma.$transaction(async (tx) => {
      const e = await tx.expense.create({
        data: {
          category,
          description,
          amount,
          date:      new Date(date),
          isPaid:    isPaid ?? false,
          proofUrl:  proofUrl ?? null,
          companyId: auth.companyId!,
        },
      });

      if (isPaid) {
        const company = await tx.company.findUnique({
          where: { id: auth.companyId! },
          select: { accountBalance: true },
        });
        const before = company?.accountBalance ?? 0;
        const after  = before - amount;
        await tx.company.update({ where: { id: auth.companyId! }, data: { accountBalance: after } });
        await tx.ledgerEntry.create({
          data: {
            companyId:     auth.companyId!,
            type:          "expense",
            amount,
            balanceBefore: before,
            balanceAfter:  after,
            description:   `Expense payment — ${e.id}`,
            referenceId:   e.id,
            createdById:   auth.userId,
          },
        });
      }

      return e;
    });

    return created(expense);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
