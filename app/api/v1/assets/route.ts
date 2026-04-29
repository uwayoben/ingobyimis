import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, created, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  category: z.string().min(1, "Category is required"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  purchaseValue: z.number().int().positive("Purchase value must be positive"),
  currentValue: z.number().int().min(0, "Current value must be non-negative"),
  depreciationRate: z.number().min(0).max(100, "Rate must be between 0 and 100"),
});

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (auth.role === "super_admin") return forbidden("Use company-scoped queries.");

    const assets = await prisma.asset.findMany({
      where: { companyId: auth.companyId! },
      orderBy: { purchaseDate: "desc" },
    });

    return ok(assets.map((a) => ({ ...a, depreciationRate: Number(a.depreciationRate) })));
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!auth.companyId) return forbidden();
    if (!["managing_director"].includes(auth.role)) return forbidden();

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const asset = await prisma.asset.create({
      data: {
        name: parsed.data.name,
        category: parsed.data.category,
        purchaseDate: new Date(parsed.data.purchaseDate),
        purchaseValue: parsed.data.purchaseValue,
        currentValue: parsed.data.currentValue,
        depreciationRate: parsed.data.depreciationRate,
        companyId: auth.companyId,
      },
    });

    return created({ ...asset, depreciationRate: Number(asset.depreciationRate) });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
