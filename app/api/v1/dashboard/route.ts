import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { unauthorized, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const cid = auth.companyId;

    const [
      totalLoans,
      activeLoans,
      overdueLoans,
      pendingLoans,
      totalCustomers,
      recentPayments,
      outstandingAgg,
      revenueAgg,
      disbursedToday,
    ] = await Promise.all([
      prisma.loan.count({ where: { companyId: cid } }),
      prisma.loan.count({ where: { companyId: cid, status: "active" } }),
      prisma.loan.count({ where: { companyId: cid, status: "overdue" } }),
      prisma.loan.count({ where: { companyId: cid, status: "pending" } }),
      prisma.customer.count({ where: { companyId: cid } }),
      prisma.payment.findMany({
        where: { companyId: cid },
        orderBy: { date: "desc" },
        take: 50,
      }),
      prisma.loan.aggregate({
        where: { companyId: cid, status: { in: ["active", "overdue"] } },
        _sum: { outstandingBalance: true },
      }),
      prisma.payment.aggregate({
        where: { companyId: cid },
        _sum: { interest: true, penalty: true },
      }),
      prisma.loan.aggregate({
        where: {
          companyId: cid,
          disbursedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
        _sum: { disbursedAmount: true },
      }),
    ]);

    const totalCollected = recentPayments.reduce((s, p) => s + p.amount, 0);
    const totalOutstanding = outstandingAgg._sum.outstandingBalance ?? 0;
    const collectionRate =
      totalOutstanding + totalCollected > 0
        ? Math.round((totalCollected / (totalOutstanding + totalCollected)) * 1000) / 10
        : 0;

    return Response.json({
      data: {
        totalLoans,
        activeLoans,
        overdueLoans,
        pendingLoans,
        totalCustomers,
        outstandingBalance: totalOutstanding,
        totalRevenue: (revenueAgg._sum.interest ?? 0) + (revenueAgg._sum.penalty ?? 0),
        disbursedToday: disbursedToday._sum.disbursedAmount ?? 0,
        collectionRate,
      },
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
