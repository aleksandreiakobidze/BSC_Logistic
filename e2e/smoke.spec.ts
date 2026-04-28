import { test, expect } from "@playwright/test";

test.describe("Public surface", () => {
  test("landing page renders and exposes login CTA", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("customer portal tracking form is visible", async ({ page }) => {
    await page.goto("/en/portal");
    await expect(page.getByPlaceholder(/tracking number/i)).toBeVisible();
  });

  test("invalid tracking code leads to 404", async ({ page }) => {
    const res = await page.goto("/en/portal/track/DOES-NOT-EXIST");
    expect(res?.status()).toBe(404);
  });
});

test.describe("Auth", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});
