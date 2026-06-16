import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, created, badRequest, unauthorized, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth || !auth.companyId) return unauthorized();

    const liabilities = await prisma.liability.findMany({
      where: { companyId: auth.companyId },
      include: {
        payments: { orderBy: { date: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(liabilities);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth || !auth.companyId) return unauthorized();

    const { lenderName, description, principalAmount, startDate, dueDate } = await request.json();

    if (!lenderName || !principalAmount || !startDate) {
      return badRequest("Lender name, principal amount, and start date are required.");
    }

    const amount = Number(principalAmount);
    if (isNaN(amount) || amount <= 0) return badRequest("Principal amount must be a positive number.");

    const liability = await prisma.liability.create({
      data: {
        companyId:         auth.companyId,
        lenderName:        lenderName.trim(),
        description:       description?.trim() || undefined,
        principalAmount:   amount,
        balanceOutstanding: amount,
        startDate:         new Date(startDate),
        dueDate:           dueDate ? new Date(dueDate) : undefined,
      },
      include: { payments: true },
    });

    return created(liability);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
