import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, notFound, unauthorized, serverError } from "@/lib/api-response";
import { classifyLoan, generateSchedule } from "@/lib/loan-schedule";

/** GET installments for a loan. Also marks overdue installments and fires notifications. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { id } = await params;

    const loan = await prisma.loan.findFirst({
      where: { id, companyId: auth.companyId! },
    });
    if (!loan) return notFound("Loan not found.");

    // Auto-generate installments if the loan has none (e.g. created before this feature)
    const existingCount = await prisma.installment.count({ where: { loanId: id } });
    if (existingCount === 0 && loan.firstPaymentDate && loan.totalInstallments > 0) {
      const schedule = generateSchedule(
        loan.amount,
        Number(loan.annualInterestRate),
        loan.interestMethod as "flat" | "declining",
        loan.totalInstallments,
        loan.firstPaymentDate,
        loan.repaymentFrequencyDays,
      );
      const today0 = new Date();
      today0.setHours(0, 0, 0, 0);
      await prisma.installment.createMany({
        data: schedule.map((row) => ({
          loanId:        id,
          installmentNo: row.installmentNo,
          dueDate:       row.dueDate,
          principalDue:  row.principalDue,
          interestDue:   row.interestDue,
          totalDue:      row.totalDue,
          status:        row.dueDate < today0 ? "overdue" : "pending",
        })),
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Mark any past-due pending installments as overdue
    const overdueInstallments = await prisma.installment.findMany({
      where: {
        loanId: id,
        status: "pending",
        dueDate: { lt: today },
      },
    });

    if (overdueInstallments.length > 0) {
      await prisma.installment.updateMany({
        where: { id: { in: overdueInstallments.map((i) => i.id) } },
        data: { status: "overdue" },
      });

      // Find earliest overdue installment to set arrearsStartDate
      const earliest = overdueInstallments.reduce((a, b) => a.dueDate < b.dueDate ? a : b);
      const daysOverdue = Math.floor((today.getTime() - earliest.dueDate.getTime()) / 86400000);
      const { loanClass, provisioningRate } = classifyLoan(daysOverdue);
      const provisionRequired = Math.round(loan.balanceOutstanding * Number(provisioningRate) / 100);

      await prisma.loan.update({
        where: { id },
        data: {
          daysOverdue,
          arrearsStartDate: loan.arrearsStartDate ?? earliest.dueDate,
          loanClass,
          provisioningRate,
          provisionRequired,
          status: "overdue",
        },
      });

      // Fire a notification if not already sent recently
      const existing = await prisma.notification.findFirst({
        where: {
          companyId: loan.companyId,
          type: "overdue",
          link: `/loans/${id}`,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });

      if (!existing) {
        await prisma.notification.create({
          data: {
            type:      "overdue",
            title:     "Overdue Installment",
            message:   `Loan ${id.slice(0, 8).toUpperCase()} has ${overdueInstallments.length} overdue installment(s). Days overdue: ${daysOverdue}.`,
            companyId: loan.companyId,
            link:      `/loans/${id}`,
          },
        });
      }
    }

    const installments = await prisma.installment.findMany({
      where: { loanId: id },
      orderBy: { installmentNo: "asc" },
    });

    return ok(installments);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
