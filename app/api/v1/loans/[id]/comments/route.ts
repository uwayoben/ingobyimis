import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, created, unauthorized, forbidden, notFound, badRequest, serverError } from "@/lib/api-response";
import { z } from "zod";

const createSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { id } = await params;

    const loan = await prisma.loan.findFirst({ where: { id, companyId: auth.companyId! } });
    if (!loan) return notFound("Loan not found.");

    const comments = await prisma.loanComment.findMany({
      where: { loanId: id },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true, role: true } } },
    });

    return ok(comments.map((c) => ({
      id:            c.id,
      loanId:        c.loanId,
      content:       c.content,
      createdById:   c.createdById,
      createdByName: c.createdBy.name,
      createdByRole: c.createdBy.role,
      createdAt:     c.createdAt,
    })));
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!auth.companyId) return forbidden("Company context required.");

    const { id } = await params;
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const loan = await prisma.loan.findFirst({ where: { id, companyId: auth.companyId } });
    if (!loan) return notFound("Loan not found.");

    const comment = await prisma.loanComment.create({
      data: {
        loanId:      id,
        content:     parsed.data.content,
        createdById: auth.userId,
        companyId:   auth.companyId,
      },
      include: { createdBy: { select: { name: true, role: true } } },
    });

    return created({
      id:            comment.id,
      loanId:        comment.loanId,
      content:       comment.content,
      createdById:   comment.createdById,
      createdByName: comment.createdBy.name,
      createdByRole: comment.createdBy.role,
      createdAt:     comment.createdAt,
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("commentId");
    if (!commentId) return badRequest("commentId is required.");

    const comment = await prisma.loanComment.findFirst({
      where: { id: commentId, loanId: id, companyId: auth.companyId! },
    });
    if (!comment) return notFound("Comment not found.");

    // Only the author or a managing director can delete
    if (comment.createdById !== auth.userId && !["managing_director", "super_admin"].includes(auth.role)) {
      return forbidden("You can only delete your own comments.");
    }

    await prisma.loanComment.delete({ where: { id: commentId } });
    return ok({ message: "Comment deleted." });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
