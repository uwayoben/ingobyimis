import { prisma } from "@/lib/prisma";

/**
 * Posts an additional-interest charge against a loan — the single code
 * path used by both the manual "Add Charge" flow and the auto-mode
 * scheduled job, so reporting and the loan detail page need no
 * special-case logic for which one produced a given charge.
 *
 * `recordedByUserId: null` marks the charge as system-generated (auto
 * mode); the audit-trail comment is authored by nobody (createdById is
 * nullable) and the UI falls back to displaying "System".
 */
export async function applyAdditionalInterestCharge({
  loanId,
  companyId,
  amount,
  reason,
  recordedByUserId,
  monthsChargedIncrement = 0,
}: {
  loanId: string;
  companyId: string;
  amount: number;
  reason: string;
  recordedByUserId: string | null;
  monthsChargedIncrement?: number;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.loanComment.create({
      data: {
        loanId,
        companyId,
        createdById: recordedByUserId,
        content: recordedByUserId
          ? `[Additional Interest] RWF ${amount.toLocaleString()} added. Reason: ${reason}`
          : `[Additional Interest] RWF ${amount.toLocaleString()} auto-applied by system. Reason: ${reason}`,
      },
    });

    return tx.loan.update({
      where: { id: loanId },
      data: {
        additionalInterest: { increment: amount },
        ...(monthsChargedIncrement > 0
          ? { additionalInterestMonthsCharged: { increment: monthsChargedIncrement } }
          : {}),
      },
    });
  });
}
