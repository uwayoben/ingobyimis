import { v2 as cloudinary } from "cloudinary";
import { getAuthUser } from "@/lib/auth";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api-response";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg":      "jpg",
  "image/png":       "png",
  "image/webp":      "webp",
  "application/pdf": "pdf",
};

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!auth.companyId) return forbidden();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) return badRequest("No file provided.");

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) return badRequest("Only JPG, PNG, WebP, or PDF files are allowed.");
    if (file.size > MAX_BYTES) return badRequest("File size must not exceed 5 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: "ingobyi/expenses", resource_type: "auto" },
        (error, res) => {
          if (error || !res) reject(error ?? new Error("Upload failed"));
          else resolve(res as { secure_url: string });
        }
      ).end(buffer);
    });

    return ok({ url: result.secure_url });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
