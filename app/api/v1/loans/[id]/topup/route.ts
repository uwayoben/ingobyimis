import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, notFound, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";
import { generateSchedule, classifyLoan } from "@/lib/loan-schedule";
import { z } from "zod";

const topUpSchema = z.object({
  topUpType:             z.enum(["addon", "refinance"]),
  topUpAmount:           z.number().int().positive(),
  newTotalInstallments:  z.number().int().positive(),
  newFirstPaymentDate:   z.string().min(1),
  newAnnualInterestRate: z.number().positive().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "loan_officer", "super_admin"].includes(auth.role)) return forbidden();
    if (!auth.companyId) return forbidden("Company context required.");

    const { id } = await params;
    const body = await request.json();
    const parsed = topUpSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const d = parsed.data;

    const loan = await prisma.loan.findFirst({
      where: { id, companyId: auth.companyId },
    });
    if (!loan) return notFound("Loan not found.");
    if (!["active", "overdue"].includes(loan.status)) {
      return badRequest("Only active or overdue loans can be topped up.");
    }
    if (loan.balanceOutstanding <= 0) {
      return badRequest("This loan has no outstanding balance to top up.");
    }

    const effectiveRate        = d.newAnnualInterestRate ?? Number(loan.annualInterestRate);
    const outstandingPrincipal = loan.balanceOutstanding;
    const newFirstPaymentDate  = new Date(d.newFirstPaymentDate);
    const n                    = d.newTotalInstallments;
    const periodsPerYear       = 360 / loan.repaymentFrequencyDays;
    const periodRate           = effectiveRate / 100 / periodsPerYear;

    // ── Determine new principal and actual cash disbursed based on top-up type ──
    // addon:    new principal = outstanding + top-up; client receives top-up in cash.
    // refinance: new principal = top-up amount (replaces the entire outstanding);
    //            client receives (top-up − outstanding) as net new cash.
    const newPrincipal = d.topUpType === "addon"
      ? outstandingPrincipal + d.topUpAmount
      : d.topUpAmount;

    const cashDisbursed = d.topUpType === "addon"
      ? d.topUpAmount
      : Math.max(0, d.topUpAmount - outstandingPrincipal);

    if (d.topUpType === "refinance" && d.topUpAmount < outstandingPrincipal) {
      return badRequest(
        `Refinance amount (RWF ${d.topUpAmount.toLocaleString()}) must be at least the outstanding balance (RWF ${outstandingPrincipal.toLocaleString()}).`
      );
    }

    // Recalculate repayment figures on newPrincipal (same formula as a fresh loan)
    let newTotalRepayable: number;
    let newInstallmentAmount: number;
    if (loan.interestMethod === "flat") {
      const totalInterest   = newPrincipal * periodRate * n;
      newTotalRepayable     = Math.round(newPrincipal + totalInterest);
      newInstallmentAmount  = Math.round(newTotalRepayable / n);
    } else {
      const exactEmi        = periodRate === 0
        ? newPrincipal / n
        : (newPrincipal * periodRate) / (1 - Math.pow(1 + periodRate, -n));
      newInstallmentAmount  = Math.round(exactEmi);
      newTotalRepayable     = Math.round(exactEmi * n);
    }

    const newMaturityDate = new Date(newFirstPaymentDate);
    newMaturityDate.setDate(newMaturityDate.getDate() + (n - 1) * loan.repaymentFrequencyDays);

    const newSchedule = generateSchedule(
      newPrincipal,
      effectiveRate,
      loan.interestMethod,
      n,
      newFirstPaymentDate,
      loan.repaymentFrequencyDays,
    );

    const { loanClass, provisioningRate } = classifyLoan(0); // reset to Normal after top-up
    const provisionRequired = Math.round(newPrincipal * provisioningRate / 100);

    const updated = await prisma.$transaction(async (tx) => {
      // Remove all remaining unpaid installments from the old schedule
      await tx.installment.deleteMany({
        where: { loanId: id, status: { in: ["pending", "overdue"] } },
      });

      // Create fresh installment schedule numbered after already-paid installments
      await tx.installment.createMany({
        data: newSchedule.map((row, i) => ({
          loanId:        id,
          installmentNo: loan.installmentsPaid + i + 1,
          dueDate:       row.dueDate,
          principalDue:  row.principalDue,
          interestDue:   row.interestDue,
          totalDue:      row.totalDue,
        })),
      });

      // Deduct actual cash disbursed from company account.
      // addon:    full top-up amount leaves the account.
      // refinance: only the net new cash (top-up − outstanding) leaves; the rest
      //            is an internal settlement of the old balance.
      const company = await tx.company.findUnique({
        where: { id: auth.companyId! },
        select: { accountBalance: true },
      });
      const balanceBefore = company?.accountBalance ?? 0;
      const balanceAfter  = balanceBefore - cashDisbursed;

      if (cashDisbursed > 0) {
        await tx.company.update({
          where: { id: auth.companyId! },
          data:  { accountBalance: balanceAfter },
        });

        await tx.ledgerEntry.create({
          data: {
            companyId:     auth.companyId!,
            type:          "disbursement",
            amount:        cashDisbursed,
            balanceBefore,
            balanceAfter,
            description:   d.topUpType === "addon"
              ? `Loan add-on top-up — ${id.slice(0, 8).toUpperCase()} (+RWF ${d.topUpAmount.toLocaleString()})`
              : `Loan refinance — ${id.slice(0, 8).toUpperCase()} (net cash RWF ${cashDisbursed.toLocaleString()})`,
            referenceId:   id,
            createdById:   auth.userId,
          },
        });
      }

      const typeLabel = d.topUpType === "addon" ? "Add-on top-up" : "Refinance top-up";
      await tx.notification.create({
        data: {
          type:      "disbursement",
          title:     `Loan ${typeLabel} Processed`,
          message:   d.topUpType === "addon"
            ? `Loan ${id.slice(0, 8).toUpperCase()} add-on: +RWF ${d.topUpAmount.toLocaleString()}. New principal: RWF ${newPrincipal.toLocaleString()}.`
            : `Loan ${id.slice(0, 8).toUpperCase()} refinanced. New principal: RWF ${newPrincipal.toLocaleString()}. Net cash to client: RWF ${cashDisbursed.toLocaleString()}.`,
          companyId: auth.companyId!,
          link:      `/loans/${id}`,
        },
      });

      // Update loan — reset repaid amounts since the schedule is now fresh from newPrincipal
      return tx.loan.update({
        where: { id },
        data: {
          amount:                newPrincipal,
          disbursedAmount:       loan.disbursedAmount + d.topUpAmount,
          topUpAmount:           loan.topUpAmount + d.topUpAmount,
          balanceOutstanding:    newPrincipal,
          totalInstallments:     loan.installmentsPaid + n,
          totalRepayable:        newTotalRepayable,
          // Reset repaid trackers so interest-remaining formula works cleanly with the new schedule
          amountRepaidPrincipal: 0,
          amountRepaidInterest:  0,
          nextPaymentDate:       newFirstPaymentDate,
          nextPaymentAmount:     newInstallmentAmount,
          agreedMaturityDate:    newMaturityDate,
          firstPaymentDate:      newFirstPaymentDate,
          annualInterestRate:    effectiveRate,
          isRestructured:        true,
          daysOverdue:           0,
          arrearsStartDate:      null,
          penaltyAmount:         0,
          status:                "active",
          loanClass,
          provisioningRate,
          provisionRequired,
        },
      });
    });

    return ok({
      ...updated,
      annualInterestRate: Number(updated.annualInterestRate),
      provisioningRate:   Number(updated.provisioningRate),
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
