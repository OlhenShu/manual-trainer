import type { PublicUser } from "@manual-trainer/shared";

export const userFixture: PublicUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "user@example.com",
  role: "user",
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const adminFixture: PublicUser = {
  ...userFixture,
  id: "22222222-2222-4222-8222-222222222222",
  email: "admin@example.com",
  role: "admin",
};
