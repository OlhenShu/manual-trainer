import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from "../env";

const passwordError = "Пароль має містити щонайменше 8 символів.";
const credentialsError = "Електронна пошта або пароль неправильні.";

function uniqueEmail() {
  return `user-${crypto.randomUUID()}@example.com`;
}

async function confirmEmail(request: APIRequestContext, email: string, password: string) {
  const registered = await request.post("/api/auth/register", { data: { email, password } });
  expect(registered.ok()).toBeTruthy();
  const body = (await registered.json()) as { verificationUrl?: string };
  expect(body.verificationUrl).toBeTruthy();
  const verified = await request.get(body.verificationUrl!);
  expect(verified.ok()).toBeTruthy();
}

async function signIn(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Електронна пошта").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page).toHaveURL("/");
}

test("registration asks to confirm the email", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/register");
  await page.getByLabel("Електронна пошта").fill(email);
  await page.getByLabel("Пароль").fill("password1");
  await page.getByRole("button", { name: "Створити обліковий запис" }).click();
  await expect(page.getByRole("heading", { name: "Підтвердьте пошту" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});

test("login flow lands on the home page", async ({ page, request }) => {
  const email = uniqueEmail();
  const password = "password1";
  await confirmEmail(request, email, password);
  await signIn(page, email, password);
  await expect(page.getByRole("heading", { name: `Вітаємо, ${email}` })).toBeVisible();
});

test("logout clears the session", async ({ page }) => {
  const email = uniqueEmail();
  await confirmEmail(page.request, email, "password1");
  await signIn(page, email, "password1");
  await page.getByRole("button", { name: "Вийти" }).click();
  await expect(page).toHaveURL("/login");
  const me = await page.request.get("/api/auth/me");
  expect(me.status()).toBe(401);
});

test("protected route redirects to login and back after sign-in", async ({ page, request }) => {
  const email = uniqueEmail();
  const password = "password1";
  await confirmEmail(request, email, password);
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Електронна пошта").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page).toHaveURL("/");
});

test("a user is redirected away from the admin page", async ({ page }) => {
  const email = uniqueEmail();
  await confirmEmail(page.request, email, "password1");
  await signIn(page, email, "password1");
  await page.goto("/admin");
  await expect(page).toHaveURL("/not-authorized");
  await expect(page.getByRole("heading", { name: "Недостатньо прав" })).toBeVisible();
});

test("an authenticated user is redirected away from login", async ({ page }) => {
  const email = uniqueEmail();
  await confirmEmail(page.request, email, "password1");
  await signIn(page, email, "password1");
  await page.goto("/login");
  await expect(page).toHaveURL("/");
});

test("registration shows a Ukrainian validation error for an empty password", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Електронна пошта").fill(uniqueEmail());
  await page.getByRole("button", { name: "Створити обліковий запис" }).click();
  await expect(page.getByText(passwordError)).toBeVisible();
  await expect(page.getByText("PASSWORD_TOO_SHORT")).toHaveCount(0);
});

test("login shows a Ukrainian API error and hides the raw message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Електронна пошта").fill("missing@example.com");
  await page.getByLabel("Пароль").fill("password1");
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page.getByText(credentialsError)).toBeVisible();
  await expect(page.getByText("Invalid credentials.")).toHaveCount(0);
});

test("an admin can open the ping page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Електронна пошта").fill(E2E_ADMIN_EMAIL);
  await page.getByLabel("Пароль").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/admin");
  await expect(page.getByText("Сервер відповів: pong")).toBeVisible();
});
