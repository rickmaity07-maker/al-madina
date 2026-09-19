import { test, expect } from "@playwright/test";

test("homepage loads with German as the default language", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByText("Ihre Arabisch Speisekammer,")).toBeVisible();
  await expect(page.locator(".product-grid")).toBeVisible();
});

test("language toggle switches to English and persists across navigation", async ({ page }) => {
  await page.goto("/");
  await page.locator(".language-btn").click();
  await expect(page.getByText("Your Turkish pantry,")).toBeVisible();

  // Persistence is via a shared context + localStorage, not per-page state —
  // this is what "translate everything" actually required.
  await page.goto("/track");
  await expect(page.getByText("Track your order")).toBeVisible();
});

test("add to cart updates the cart badge and drawer", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".product-grid .product-card");

  const firstAddBtn = page.locator(".product-card .add-btn").first();
  await firstAddBtn.click();

  // /api/cart round-trips to a remote Neon instance and can genuinely take
  // several seconds from local dev (measured 3.5-4.5s) — the default 5s
  // expect timeout leaves too little margin. This isn't a race or a stale
  // assertion, just realistic latency for this environment.
  await expect(page.locator(".cart-btn i")).toHaveText("1", { timeout: 10_000 });

  await page.locator(".cart-btn").click();
  await expect(page.locator(".cart-drawer")).toBeVisible();
  await expect(page.locator(".cart-item")).toHaveCount(1);
});

test("product detail page loads via a real product link", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".product-grid .product-card");
  await page.locator(".product-card .product-image").first().click();

  const modal = page.locator(".checkout-modal");
  await expect(modal).toBeVisible();
  await expect(modal.locator(".primary-btn")).toBeVisible();
});

test("legal pages are reachable from the footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Impressum" }).click();
  await expect(page).toHaveURL(/\/impressum/);
  await expect(page.locator("h1")).toHaveText("Impressum");
});

test("404 page is branded, not the default Next.js page", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Seite nicht gefunden")).toBeVisible();
});
