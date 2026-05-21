import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, notFound, unauthorized, serverError } from "@/lib/api-response";

/** GET installments for a loan — returns the stored schedule without any auto-classification. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { id } = await params;

    const loan = await prisma.loan.findFirst({
      where: { id, companyId: auth.companyId! },
    });
    if (!loan) return notFound("Loan not found.");

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
