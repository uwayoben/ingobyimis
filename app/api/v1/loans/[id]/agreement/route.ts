import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { unauthorized, notFound, serverError } from "@/lib/api-response";
import { generateLoanAgreementBuffer } from "@/lib/loan-agreement";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { id } = await params;

    const loan = await prisma.loan.findFirst({
      where: auth.role === "super_admin" ? { id } : { id, companyId: auth.companyId! },
      include: {
        customer:    true,
        company:     true,
        loanOfficer: { select: { name: true } },
      },
    });
    if (!loan) return notFound("Loan not found.");

    const managingDirector = await prisma.user.findFirst({
      where: { companyId: loan.companyId, role: "managing_director" },
      select: { name: true },
    });

    const buffer = generateLoanAgreementBuffer({
      company: { name: loan.company.name, address: loan.company.address },
      managingDirectorName: managingDirector?.name ?? "—",
      customer: {
        names:          loan.customer.names,
        dateOfBirth:    loan.customer.dateOfBirth,
        nationalId:     loan.customer.nationalId,
        phone:          loan.customer.phone,
        email:          loan.customer.email,
        cell:           loan.customer.cell,
        sector:         loan.customer.sector,
        district:       loan.customer.district,
        province:       loan.customer.province,
        spouseName:     loan.customer.spouseName,
        spouseIdNumber: loan.customer.spouseIdNumber,
        spousePhone:    loan.customer.spousePhone,
      },
      loan: {
        amount:                      loan.amount,
        processingFeeRate:           Number(loan.processingFeeRate ?? 0),
        totalProcessingFeeScheduled: loan.totalProcessingFeeScheduled ?? 0,
        annualInterestRate:          Number(loan.annualInterestRate),
        totalInstallments:           loan.totalInstallments,
        nextPaymentAmount:           loan.nextPaymentAmount,
        firstPaymentDate:            loan.firstPaymentDate,
        agreedMaturityDate:          loan.agreedMaturityDate,
        disbursementDate:            loan.disbursementDate,
      },
      loanOfficerName: loan.loanOfficer.name,
    });

    const fileName = `Amasezerano-${loan.customer.names.replace(/\s+/g, "-")}-${loan.id}.docx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
