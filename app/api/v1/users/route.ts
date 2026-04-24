import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, created, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";
import { z } from "zod";
import bcrypt from "bcryptjs";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["managing_director", "loan_officer", "receptionist", "shareholder"]),
  phone: z.string().optional(),
  companyId: z.string().optional(), // honoured only for super_admin
});

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "super_admin"].includes(auth.role)) return forbidden();

    const { searchParams } = new URL(request.url);
    const targetCompanyId =
      auth.role === "super_admin" && searchParams.get("companyId")
        ? searchParams.get("companyId")!
        : auth.companyId;

    const users = await prisma.user.findMany({
      where: { companyId: targetCompanyId },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, isActive: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(users);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "super_admin"].includes(auth.role)) return forbidden("Only managers can create users.");

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

    const targetCompanyId =
      auth.role === "super_admin" && parsed.data.companyId
        ? parsed.data.companyId
        : auth.companyId;

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: hashedPassword,
        role: parsed.data.role,
        phone: parsed.data.phone,
        companyId: targetCompanyId,
      },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, isActive: true, createdAt: true,
      },
    });

    return created(user);
  } catch (e: any) {
    if (e?.code === "P2002") return badRequest("A user with this email already exists.");
    console.error(e);
    return serverError();
  }
}
