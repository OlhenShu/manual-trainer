import "dotenv/config";
import { registerSchema } from "@manual-trainer/shared";
import { db } from "../src/db.js";
import { hashPassword } from "../src/services/auth.js";
import { seedCatalog } from "./seedCatalog.js";

const existing = await db.scenario.count();
if (existing === 0) {
  await seedCatalog();
  console.log("Catalog seeded.");
} else {
  console.log(`Catalog already has ${existing} scenarios.`);
}

const rawEmail = process.env["ADMIN_EMAIL"]?.trim().toLowerCase();
const rawPassword = process.env["ADMIN_PASSWORD"];
if (rawEmail && rawPassword) {
  const passwordResult = registerSchema.shape.password.safeParse(rawPassword);
  if (!passwordResult.success) {
    console.error("ADMIN_PASSWORD does not meet the password rules. Admin was not created.");
  } else {
    const found = await db.user.findUnique({ where: { email: rawEmail } });
    if (found) {
      console.log(`Admin seed skipped: ${rawEmail} already exists (role: ${found.role}).`);
    } else {
      const admin = await db.user.create({
        data: {
          email: rawEmail,
          passwordHash: await hashPassword(rawPassword),
          role: "admin",
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`Admin created (${admin.id}).`);
    }
  }
}

await db.$disconnect();
