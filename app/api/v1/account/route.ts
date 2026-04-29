import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, created, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";
import { z } from "zod";

const depositSchema = z.object({
  type:        z.enum(["deposit", "withdrawal"]),
  amount:      z.number().int().positive("Amount must be positive"),
  description: z.string().min(1, "Description is required"),
});

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!auth.companyId) return forbidden();

    const [company, entries] = await Promise.all([
      prisma.company.findUnique({ where: { id: auth.companyId }, select: { accountBalance: true } }),
      prisma.ledgerEntry.findMany({
        where: { companyId: auth.companyId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return ok({ balance: company?.accountBalance ?? 0, entries });
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
    if (auth.role !== "managing_director") return forbidden("Only the managing director can record deposits or withdrawals.");

    const body   = await request.json();
    const parsed = depositSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const { type, amount, description } = parsed.data;

    const entry = await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: auth.companyId! },
        select: { accountBalance: true },
      });
      const before = company?.accountBalance ?? 0;
      const after  = type === "deposit" ? before + amount : before - amount;

      await tx.company.update({
        where: { id: auth.companyId! },
        data:  { accountBalance: after },
      });

      return tx.ledgerEntry.create({
        data: {
          companyId:    auth.companyId!,
          type,
          amount,
          balanceBefore: before,
          balanceAfter:  after,
          description,
          createdById:  auth.userId,
        },
      });
    });

    return created(entry);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
