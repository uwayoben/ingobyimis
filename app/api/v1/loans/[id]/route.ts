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
      where: auth.role === "super_admin" ? { id } : { id, companyId: auth.companyId! },
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
      annualInterestRate:  Number(loan.annualInterestRate),
      provisioningRate:    Number(loan.provisioningRate),
      managementFeeRate:   Number(loan.managementFeeRate),
      processingFeeRate:   Number((loan as any).processingFeeRate ?? 0),
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

    const isSuperAdmin = auth.role === "super_admin";

    const loan = await prisma.loan.findFirst({
      where: isSuperAdmin ? { id } : { id, companyId: auth.companyId! },
    });
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

    // Field editing — super_admin only, any loan status
    const editableFields = ["purpose", "amount", "annualInterestRate", "interestMethod",
      "totalInstallments", "repaymentFrequencyDays", "gracePeriodDays",
      "branchName", "managementFeeRate", "processingFeeRate", "penaltyRatePerDay"];
    const hasFieldEdit = editableFields.some((f) => body[f] !== undefined);
    if (hasFieldEdit && !isSuperAdmin) {
      return forbidden("Only super_admin can edit loan details.");
    }

    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;

    if (hasFieldEdit && isSuperAdmin) {
      if (body.purpose            !== undefined) updateData.purpose            = body.purpose;
      if (body.branchName         !== undefined) updateData.branchName         = body.branchName || null;
      if (body.interestMethod     !== undefined) updateData.interestMethod     = body.interestMethod;
      if (body.gracePeriodDays    !== undefined) updateData.gracePeriodDays    = Number(body.gracePeriodDays);
      if (body.penaltyRatePerDay  !== undefined) updateData.penaltyRatePerDay  = Number(body.penaltyRatePerDay);

      const newAmount    = body.amount             !== undefined ? Number(body.amount)             : null;
      const newRate      = body.annualInterestRate  !== undefined ? Number(body.annualInterestRate) : null;
      const newN         = body.totalInstallments   !== undefined ? Number(body.totalInstallments)  : null;
      const newFreqDays  = body.repaymentFrequencyDays !== undefined ? Number(body.repaymentFrequencyDays) : null;
      const newMgmtRate  = body.managementFeeRate   !== undefined ? Number(body.managementFeeRate)  : null;
      const newProcRate  = body.processingFeeRate   !== undefined ? Number(body.processingFeeRate)  : null;

      if (newAmount    !== null) updateData.amount             = newAmount;
      if (newRate      !== null) updateData.annualInterestRate = newRate;
      if (newN         !== null) updateData.totalInstallments  = newN;
      if (newFreqDays  !== null) updateData.repaymentFrequencyDays = newFreqDays;
      if (newMgmtRate  !== null) updateData.managementFeeRate  = newMgmtRate;
      if (newProcRate  !== null) updateData.processingFeeRate  = newProcRate;

      // Recalculate totals when financial terms change
      const principal  = newAmount   ?? loan.amount;
      const annualRate = newRate     ?? Number(loan.annualInterestRate);
      const n          = newN        ?? loan.totalInstallments;
      const freqDays   = newFreqDays ?? loan.repaymentFrequencyDays;
      const mgmtRate   = newMgmtRate ?? Number(loan.managementFeeRate);
      const procRate   = newProcRate ?? Number((loan as any).processingFeeRate ?? 0);
      const method     = (updateData.interestMethod ?? loan.interestMethod) as string;
      const periodsPerYear = 360 / freqDays;
      const r  = annualRate / 100 / periodsPerYear;
      const m  = mgmtRate   / 100 / periodsPerYear;
      const p  = procRate   / 100 / periodsPerYear;
      const combined = r + m + p;
      let totalRepayable: number;
      if (method === "flat") {
        totalRepayable = Math.round(principal + principal * r * n + principal * m * n + principal * p * n);
      } else {
        const emi = combined === 0 ? principal / n
          : (principal * combined * Math.pow(1 + combined, n)) / (Math.pow(1 + combined, n) - 1);
        totalRepayable = Math.round(emi * n);
      }
      updateData.totalRepayable     = totalRepayable;
      updateData.balanceOutstanding = principal;
    }

    if (body.signedContractUrl !== undefined) {
      updateData.signedContractUrl = body.signedContractUrl;
    }

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
        Number((loan as any).processingFeeRate ?? 0),
      );
      const totalMgmtFeeScheduled        = schedule.reduce((s, r) => s + r.managementFeeDue, 0);
      const totalProcessingFeeScheduled  = schedule.reduce((s, r) => s + r.processingFeeDue, 0);
      const totalInterestScheduled       = schedule.reduce((s, r) => s + r.interestDue,      0);

      updateData.disbursementDate       = disbDate;
      updateData.disbursedAmount        = disburseAmount;
      updateData.balanceOutstanding     = disburseAmount;
      updateData.firstPaymentDate       = firstPmt;
      updateData.agreedMaturityDate     = maturityDate;
      updateData.nextPaymentDate        = firstPmt;
      updateData.totalInterestScheduled      = totalInterestScheduled;
      updateData.totalMgmtFeeScheduled       = totalMgmtFeeScheduled;
      updateData.totalProcessingFeeScheduled = totalProcessingFeeScheduled;
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
              processingFeeDue: row.processingFeeDue,
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
    if (!["managing_director", "loan_officer", "super_admin"].includes(auth.role)) {
      return forbidden("Only a managing director or loan officer can delete loans.");
    }

    const { id } = await params;

    const loan = await prisma.loan.findFirst({
      where: auth.role === "super_admin" ? { id } : { id, companyId: auth.companyId! },
    });
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
