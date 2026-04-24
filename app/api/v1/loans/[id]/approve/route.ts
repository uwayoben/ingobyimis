import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, notFound, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "super_admin"].includes(auth.role)) return forbidden("Only managers can approve loans.");

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action: "approve" | "reject" = body.action ?? "approve";

    const loan = await prisma.loan.findFirst({ where: { id, companyId: auth.companyId } });
    if (!loan) return notFound("Loan not found.");
    if (loan.status !== "pending") return badRequest(`Loan is already ${loan.status}.`);

    const updated = await prisma.loan.update({
      where: { id },
      data: {
        status: action === "approve" ? "approved" : "rejected",
        approvedById: action === "approve" ? auth.userId : undefined,
        approvedAt: action === "approve" ? new Date() : undefined,
      },
    });

    await prisma.notification.create({
      data: {
        type: "disbursement",
        title: action === "approve" ? "Loan Approved" : "Loan Rejected",
        message: `Loan ${id.toUpperCase()} has been ${action === "approve" ? "approved" : "rejected"} by ${auth.name}.`,
        companyId: auth.companyId,
        link: `/loans/${id}`,
      },
    });

    return ok(updated);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
