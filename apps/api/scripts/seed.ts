import "dotenv/config";
import { registerSchema } from "@manual-trainer/shared";
import { db } from "../src/db.js";
import { hashPassword } from "../src/services/auth.js";
import { seedCatalog } from "./seedCatalog.js";

async function seed(): Promise<void> {
  const rawEmail = process.env["ADMIN_EMAIL"];
  const rawPassword = process.env["ADMIN_PASSWORD"];

  // 1. Ensure both env variables are present
  if (!rawEmail || !rawPassword) {
    console.error(
      "Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required."
    );
    process.exit(1);
  }

  // 2. Normalise email
  const email = rawEmail.trim().toLowerCase();

  // 3. Validate password against the shared schema rules
  const passwordResult = registerSchema.shape.password.safeParse(rawPassword);
  if (!passwordResult.success) {
    const messages = passwordResult.error.issues
      .map((issue) => issue.message)
      .join(", ");
    console.error(`Error: Invalid ADMIN_PASSWORD — ${messages}`);
    process.exit(1);
  }

  // 4. Check if the email already exists
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    await seedCatalog();
    console.log(
      `Warning: A user with email "${email}" already exists (role: ${existing.role}). No changes were made.`
    );
    process.exit(0);
  }

  // 5. Create the admin account
  const passwordHash = await hashPassword(rawPassword);
  const admin = await db.user.create({
    data: {
      email,
      passwordHash,
      role: "admin",
      emailVerifiedAt: new Date(),
    },
  });

  await seedCatalog();

  console.log(
    `Admin account created successfully (id: ${admin.id}, email: ${admin.email}).`
  );
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error("Unexpected error during seeding:", err);
  process.exit(1);
});
