import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!auth.companyId) return ok([]);

    const cid = auth.companyId;

    const [payments, loans] = await Promise.all([
      prisma.payment.findMany({
        where: { companyId: cid },
        orderBy: { date: "desc" },
        take: 10,
        select: {
          id: true,
          amount: true,
          date: true,
          loanId: true,
          customer: { select: { names: true } },
        },
      }),
      prisma.loan.findMany({
        where: {
          companyId: cid,
          status: { in: ["pending", "disbursed", "overdue"] },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          amount: true,
          disbursedAmount: true,
          status: true,
          createdAt: true,
          disbursementDate: true,
          updatedAt: true,
          customer: { select: { names: true } },
        },
      }),
    ]);

    type ActivityType = "payment" | "loan_pending" | "disbursement" | "overdue";

    const activities: {
      id: string;
      type: ActivityType;
      title: string;
      amount: number;
      date: string;
      link: string;
    }[] = [];

    for (const p of payments) {
      activities.push({
        id: `pay-${p.id}`,
        type: "payment",
        title: `Payment received from ${p.customer.names}`,
        amount: p.amount,
        date: p.date.toISOString(),
        link: `/loans/${p.loanId}`,
      });
    }

    for (const l of loans) {
      if (l.status === "pending") {
        activities.push({
          id: `loan-pending-${l.id}`,
          type: "loan_pending",
          title: `Loan application by ${l.customer.names}`,
          amount: l.amount,
          date: l.createdAt.toISOString(),
          link: `/loans/${l.id}`,
        });
      } else if (l.status === "disbursed" && l.disbursementDate) {
        activities.push({
          id: `loan-disbursed-${l.id}`,
          type: "disbursement",
          title: `Loan disbursed to ${l.customer.names}`,
          amount: l.disbursedAmount ?? l.amount,
          date: l.disbursementDate.toISOString(),
          link: `/loans/${l.id}`,
        });
      } else if (l.status === "overdue") {
        activities.push({
          id: `loan-overdue-${l.id}`,
          type: "overdue",
          title: `Overdue loan — ${l.customer.names}`,
          amount: l.amount,
          date: l.updatedAt.toISOString(),
          link: `/loans/${l.id}`,
        });
      }
    }

    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return ok(activities.slice(0, 8));
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
