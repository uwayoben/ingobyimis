import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!auth.companyId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const from   = searchParams.get("from");
    const to     = searchParams.get("to");
    const status = searchParams.get("status");
    const search = (searchParams.get("search") ?? "").trim();

    const fromDate = from ? new Date(from)                       : undefined;
    const toDate   = to   ? new Date(to + "T23:59:59.999Z")     : undefined;

    const installments = await prisma.installment.findMany({
      where: {
        loan: {
          companyId: auth.companyId,
          ...(search ? { customer: { names: { contains: search } } } : {}),
        },
        ...(fromDate || toDate
          ? { dueDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
          : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(status && status !== "all" ? { status: status as any } : {}),
      },
      include: {
        loan: {
          select: {
            id: true,
            purpose: true,
            status: true,
            customer: { select: { names: true, phone: true } },
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { installmentNo: "asc" }],
      take: 500,
    });

    const summary = {
      total:        installments.length,
      totalDue:     installments.reduce((s, i) => s + i.totalDue, 0),
      totalPaid:    installments.reduce((s, i) => s + i.amountPaid, 0),
      overdueCount: installments.filter((i) => i.status === "overdue").length,
      paidCount:    installments.filter((i) => i.status === "paid").length,
      pendingCount: installments.filter((i) => i.status === "pending").length,
    };

    return ok({ installments, summary });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
