import { prisma } from "@/lib/prisma";
import { Prisma } from '@prisma/client';
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, badRequest, forbidden, serverError } from "@/lib/api-response";
import { z } from "zod";

const rowSchema = z.object({
  names: z.string().min(1, "names is required"),
  nationalId: z.string().min(1, "nationalId is required"),
  dateOfBirth: z.string().min(1, "dateOfBirth is required"),
  gender: z.enum(["Male", "Female"], { error: "gender must be Male or Female" }),
  province: z.string().min(1, "province is required"),
  district: z.string().min(1, "district is required"),
  sector: z.string().min(1, "sector is required"),
  cell: z.string().min(1, "cell is required"),
  village: z.string().min(1, "village is required"),
  phone: z.string().min(1, "phone is required"),
  email: z.string().email().optional().or(z.literal("")).or(z.null()).transform((v) => v || null),
  maritalStatus: z.enum(["Single", "Married", "Divorced", "Widowed"], { error: "maritalStatus must be Single, Married, Divorced, or Widowed" }),
  employmentStatus: z.string().min(1, "employmentStatus is required"),
  employerName: z.string().optional().nullable().transform((v) => v || null),
  relationshipWithNdfsp: z.string().optional().nullable().transform((v) => v || null),
  spouseName: z.string().optional().nullable().transform((v) => v || null),
  spousePhone: z.string().optional().nullable().transform((v) => v || null),
  spouseIdNumber: z.string().optional().nullable().transform((v) => v || null),
  maritalPropertyRegime: z.string().optional().nullable().transform((v) => v || null),
});

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "loan_officer"].includes(auth.role)) return forbidden();
    if (!auth.companyId) return forbidden("Company context required.");

    const body = await request.json();
    const rows: unknown[] = body.customers;
    if (!Array.isArray(rows) || rows.length === 0) return badRequest("No customer rows provided.");
    if (rows.length > 500) return badRequest("Maximum 500 customers per import.");

    const valid: any[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const parsed = rowSchema.safeParse(rows[i]);
      if (!parsed.success) {
        errors.push({ row: i + 2, message: parsed.error.issues[0].message });
        continue;
      }
      // Support DD/MM/YYYY (Excel export) in addition to YYYY-MM-DD
      let dob: Date;
      const ddmm = parsed.data.dateOfBirth.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (ddmm) {
        dob = new Date(`${ddmm[3]}-${ddmm[2].padStart(2, "0")}-${ddmm[1].padStart(2, "0")}`);
      } else {
        dob = new Date(parsed.data.dateOfBirth);
      }
      if (isNaN(dob.getTime())) {
        errors.push({ row: i + 2, message: `Invalid dateOfBirth: "${parsed.data.dateOfBirth}" — use YYYY-MM-DD or DD/MM/YYYY` });
        continue;
      }
      valid.push({
        ...parsed.data,
        dateOfBirth: dob,
        companyId: auth.companyId!,
      });
    }

    let imported = 0;
    if (valid.length > 0) {
      const result = await prisma.customer.createMany({
        data: valid,
        skipDuplicates: true,
      });
      imported = result.count;
    }

    const skipped = valid.length - imported;
    return ok({ imported, skipped, errors, total: rows.length });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
