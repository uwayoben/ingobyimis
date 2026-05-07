import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, notFound, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";
import { classifyLoan } from "@/lib/loan-schedule";

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
      updateData.disbursementDate   = new Date();
      updateData.disbursedAmount    = body.disbursedAmount ?? loan.amount;
      updateData.balanceOutstanding = body.disbursedAmount ?? loan.amount;
      updateData.status             = "active";
    }

    if (body.status === "written_off") {
      updateData.writtenOffDate = new Date();
    }

    if (body.isRestructured !== undefined) {
      updateData.isRestructured = body.isRestructured;
    }

    // For disbursements, deduct from company account balance atomically
    if ((body.status === "disbursed" || body.status === "active") && auth.companyId) {
      const disburseAmount = (body.disbursedAmount ?? loan.amount) as number;
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
