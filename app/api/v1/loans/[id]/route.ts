import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, notFound, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";
import { classifyLoan, generateSchedule } from "@/lib/loan-schedule";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { id } = await params;

    const loan = await prisma.loan.findFirst({
      where: { id, companyId: auth.companyId! },
      include: {
        customer:     true,
        fees:         true,
        payments:     { orderBy: { date: "desc" } },
        installments: { orderBy: { installmentNo: "asc" } },
        loanOfficer:  { select: { id: true, name: true, role: true } },
        approvedBy:   { select: { id: true, name: true, role: true } },
        documents:    { orderBy: { createdAt: "asc" } },
      },
    });

    if (!loan) return notFound("Loan not found.");

    return ok({
      ...loan,
      annualInterestRate: Number(loan.annualInterestRate),
      provisioningRate:   Number(loan.provisioningRate),
      installmentsOutstanding: loan.totalInstallments - loan.installmentsPaid,
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { id } = await params;
    const body   = await request.json();

    const loan = await prisma.loan.findFirst({ where: { id, companyId: auth.companyId! } });
    if (!loan) return notFound("Loan not found.");

    // Role-based action enforcement
    if ((body.status === "approved" || body.status === "rejected") &&
        !["managing_director", "super_admin"].includes(auth.role)) {
      return forbidden("Only a managing director can approve or reject loans.");
    }
    if ((body.status === "active" || body.status === "disbursed") &&
        !["managing_director", "loan_officer", "super_admin"].includes(auth.role)) {
      return forbidden("You do not have permission to disburse loans.");
    }

    const updateData: Record<string, unknown> = { status: body.status };

    if (body.status === "approved") {
      updateData.approvedById = auth.userId;
      updateData.approvedAt   = new Date();
    }

    if (body.status === "disbursed" || body.status === "active") {
      const disbDate        = body.disbursementDate ? new Date(body.disbursementDate) : new Date();
      const disburseAmount  = (body.disbursedAmount ?? loan.amount) as number;

      // First payment = disbursement date + one repayment period + grace period
      const firstPmt = new Date(disbDate);
      firstPmt.setDate(firstPmt.getDate() + loan.repaymentFrequencyDays + (loan.gracePeriodDays ?? 0));

      // Maturity date = first payment + (n-1) more periods
      const maturityDate = new Date(firstPmt);
      maturityDate.setDate(maturityDate.getDate() + (loan.totalInstallments - 1) * loan.repaymentFrequencyDays);

      // Generate installment schedule from disbursement date
      const schedule = generateSchedule(
        disburseAmount,
        Number(loan.annualInterestRate),
        loan.interestMethod,
        loan.totalInstallments,
        firstPmt,
        loan.repaymentFrequencyDays,
        Number(loan.managementFeeRate),
      );
      const totalMgmtFeeScheduled  = schedule.reduce((s, r) => s + r.managementFeeDue, 0);
      const totalInterestScheduled = schedule.reduce((s, r) => s + r.interestDue,      0);

      updateData.disbursementDate       = disbDate;
      updateData.disbursedAmount        = disburseAmount;
      updateData.balanceOutstanding     = disburseAmount;
      updateData.firstPaymentDate       = firstPmt;
      updateData.agreedMaturityDate     = maturityDate;
      updateData.nextPaymentDate        = firstPmt;
      updateData.totalInterestScheduled = totalInterestScheduled;
      updateData.totalMgmtFeeScheduled  = totalMgmtFeeScheduled;
      updateData.status                 = "active";
      updateData._schedule              = schedule; // passed into transaction below
    }

    if (body.status === "written_off") {
      updateData.writtenOffDate = new Date();
    }

    if (body.isRestructured !== undefined) {
      updateData.isRestructured = body.isRestructured;
    }

    // For disbursements, deduct from company account balance and create schedule atomically
    if ((body.status === "disbursed" || body.status === "active") && auth.companyId) {
      const disburseAmount = updateData.disbursedAmount as number;
      const schedule       = updateData._schedule as ReturnType<typeof generateSchedule> | undefined;
      delete updateData._schedule;

      const updated = await prisma.$transaction(async (tx) => {
        const company = await tx.company.findUnique({
          where: { id: auth.companyId! },
          select: { accountBalance: true },
        });
        const before = company?.accountBalance ?? 0;
        const after  = before - disburseAmount;

        await tx.company.update({ where: { id: auth.companyId! }, data: { accountBalance: after } });
        await tx.ledgerEntry.create({
          data: {
            companyId:     auth.companyId!,
            type:          "disbursement",
            amount:        disburseAmount,
            balanceBefore: before,
            balanceAfter:  after,
            description:   `Loan disbursement — ${id}`,
            referenceId:   id,
            createdById:   auth.userId,
          },
        });

        // Replace any existing installments with the freshly generated schedule
        if (schedule?.length) {
          await tx.installment.deleteMany({ where: { loanId: id } });
          await tx.installment.createMany({
            data: schedule.map((row) => ({
              loanId:           id,
              installmentNo:    row.installmentNo,
              dueDate:          row.dueDate,
              principalDue:     row.principalDue,
              interestDue:      row.interestDue,
              managementFeeDue: row.managementFeeDue,
              totalDue:         row.totalDue,
            })),
          });
        }

        return tx.loan.update({ where: { id }, data: updateData });
      });
      return ok({ ...updated, annualInterestRate: Number(updated.annualInterestRate) });
    }

    const updated = await prisma.loan.update({ where: { id }, data: updateData });
    return ok({ ...updated, annualInterestRate: Number(updated.annualInterestRate) });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "super_admin"].includes(auth.role)) {
      return forbidden("Only a managing director can delete loans.");
    }

    const { id } = await params;

    const loan = await prisma.loan.findFirst({ where: { id, companyId: auth.companyId! } });
    if (!loan) return notFound("Loan not found.");

    // Reverse disbursement ledger entry if the loan was disbursed
    await prisma.$transaction(async (tx) => {
      if (loan.disbursedAmount > 0 && auth.companyId) {
        const company = await tx.company.findUnique({
          where: { id: auth.companyId },
          select: { accountBalance: true },
        });
        const before = company?.accountBalance ?? 0;
        const after  = before + loan.disbursedAmount;
        await tx.company.update({ where: { id: auth.companyId }, data: { accountBalance: after } });
        await tx.ledgerEntry.create({
          data: {
            companyId:     auth.companyId,
            type:          "withdrawal",
            amount:        loan.disbursedAmount,
            balanceBefore: before,
            balanceAfter:  after,
            description:   `Loan deletion reversal — ${id}`,
            referenceId:   id,
            createdById:   auth.userId,
          },
        });
      }
      await tx.loan.delete({ where: { id } });
    });

    return ok({ message: "Loan deleted successfully." });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
