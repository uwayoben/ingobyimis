import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "uwayoben11@gmail.com";
  const password = "admin@123!";
  const name = "Benjamin Uwayo";
  const phone = "0786748801";

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashed,
      name,
      phone,
      role: "super_admin",
      isActive: true,
    },
    create: {
      email,
      password: hashed,
      name,
      phone,
      role: "super_admin",
      isActive: true,
      companyId: null,
    },
  });

  console.log(`✅ Super admin ready: ${user.email} (id: ${user.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
