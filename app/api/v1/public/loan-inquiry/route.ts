import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound, serverError } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({
  loanId: z.string().min(1),
  phone:  z.string().min(1),
});

// Reduce a phone string to its last 9 digits for a format-agnostic comparison.
// Handles: +250788123456, 0788123456, 250788123456, 788123456, with/without spaces.
function normalisePhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.length >= 9) return digits.slice(-9);
  return digits;
}

function phonesMatch(stored: string, entered: string): boolean {
  const a = normalisePhone(stored);
  const b = normalisePhone(entered);
  // Must have at least 9 digits to be a valid phone comparison
  if (a.length < 9 || b.length < 9) return false;
  return a === b;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    // Lowercase the loan ID — the dashboard displays IDs in uppercase but they are stored lowercase.
    const loanId = parsed.data.loanId.trim().toLowerCase();
    const phone  = parsed.data.phone.trim();

    const loan = await prisma.loan.findFirst({
      where: { id: { startsWith: loanId } },
      include: {
        customer:     { select: { names: true, phone: true } },
        installments: { orderBy: { installmentNo: "asc" } },
        fees:         true,
        payments:     {
          orderBy: { date: "desc" },
          select: { id: true, amount: true, date: true, method: true, reference: true, principal: true, interest: true, penalty: true },
        },
      },
    });

    // Return the same error whether the loan doesn't exist or the phone is wrong,
    // so callers can't probe which loan IDs are valid.
    if (!loan) return notFound("Loan not found or phone number does not match.");

    if (!phonesMatch(loan.customer.phone, phone)) {
      return notFound("Loan not found or phone number does not match.");
    }

    const totalScheduledInterest = loan.totalRepayable - loan.amount;
    const remainingInterest      = Math.max(0, totalScheduledInterest - loan.amountRepaidInterest);
    const totalOutstanding       = loan.balanceOutstanding + remainingInterest + loan.penaltyAmount;
    const totalPaid              = loan.amountRepaidPrincipal + loan.amountRepaidInterest;

    return ok({
      id:                     loan.id,
      customerName:           loan.customer.names,
      status:                 loan.status,
      amount:                 loan.amount,
      disbursedAmount:        loan.disbursedAmount,
      disbursementDate:       loan.disbursementDate,
      totalRepayable:         loan.totalRepayable,
      annualInterestRate:     Number(loan.annualInterestRate),
      interestMethod:         loan.interestMethod,
      repaymentFrequencyDays: loan.repaymentFrequencyDays,
      totalInstallments:      loan.totalInstallments,
      installmentsPaid:       loan.installmentsPaid,
      amountRepaidPrincipal:  loan.amountRepaidPrincipal,
      amountRepaidInterest:   loan.amountRepaidInterest,
      totalPaid,
      balanceOutstanding:     loan.balanceOutstanding,
      remainingInterest,
      totalOutstanding,
      penaltyAmount:          loan.penaltyAmount,
      nextPaymentDate:        loan.nextPaymentDate,
      nextPaymentAmount:      loan.nextPaymentAmount,
      agreedMaturityDate:     loan.agreedMaturityDate,
      firstPaymentDate:       loan.firstPaymentDate,
      daysOverdue:            loan.daysOverdue,
      loanClass:              loan.loanClass,
      fees: loan.fees.map((f) => ({
        name:        f.name,
        type:        f.type,
        value:       Number(f.value),
        isRecurring: f.isRecurring,
      })),
      installments: loan.installments.map((i) => ({
        installmentNo: i.installmentNo,
        dueDate:       i.dueDate,
        principalDue:  i.principalDue,
        interestDue:   i.interestDue,
        totalDue:      i.totalDue,
        amountPaid:    i.amountPaid,
        paidDate:      i.paidDate,
        status:        i.status,
      })),
      payments: loan.payments.map((p) => ({
        id:        p.id,
        amount:    p.amount,
        date:      p.date,
        method:    p.method,
        reference: p.reference,
        principal: p.principal,
        interest:  p.interest,
        penalty:   p.penalty,
      })),
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
