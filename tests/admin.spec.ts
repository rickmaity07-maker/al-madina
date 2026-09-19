import { test, expect } from "@playwright/test";

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    test.skip(!username || !password, "ADMIN_USERNAME/ADMIN_PASSWORD not set in .env");

    await page.goto("/admin/login");
    await page.locator("form input").nth(0).fill(username!);
    await page.locator('input[type="password"]').fill(password!);
    await page.locator("form button").click();
    await page.waitForURL(/\/admin$/);
  });

  test("logs in and shows the orders dashboard", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Bestellungen" })).toBeVisible();
  });

  test("rejects wrong credentials with a clear error, not a crash", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator("form input").nth(0).fill("wrong-user");
    await page.locator('input[type="password"]').fill("wrong-pass");
    await page.locator("form button").click();
    await expect(page.getByText(/ungültig/i)).toBeVisible();
  });

  test("products page: create, verify on storefront, then delete", async ({ page, request }) => {
    // A unique name per run means a leftover row from an interrupted previous
    // run can never collide with this run's own strict-mode locator checks.
    const name = `Playwright Test Product ${Date.now()}`;

    await page.goto("/admin/products");
    await page.getByRole("button", { name: /Produkt hinzufügen/i }).click();

    await page.getByPlaceholder("z. B. Bäckerei").fill("Playwright Test Category");
    await page.locator(".input").first().fill(name);
    await page.getByPlaceholder("https://…").fill("https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5");
    await page.getByPlaceholder(/z\. B\. 500g/).fill("Test size");
    await page.getByPlaceholder("Preis €").fill("2.50");

    await page.getByRole("button", { name: /Produkt speichern/i }).click();

    try {
      // Creating a product with a new category chains several sequential DB
      // round trips (category lookup/create, slug check, product + variant
      // insert, then a read-back) — give this realistic headroom rather
      // than the tight 5s default.
      await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

      // Confirm it actually reaches the public storefront endpoint, not just the admin list.
      const res = await request.get("/api/products");
      const products: { id: string; name: string }[] = await res.json();
      const created = products.find((p) => p.name === name);
      expect(created).toBeTruthy();
    } finally {
      // Clean up so the test is repeatable and doesn't leave junk data
      // behind, even if an assertion above throws. Guarded: if the product
      // never actually rendered, there's nothing to delete.
      const deleteBtn = page.getByRole("button", { name: new RegExp(`${name} löschen`) });
      if (await deleteBtn.count()) {
        page.on("dialog", (d) => d.accept());
        await deleteBtn.click();
        await expect(page.getByText(name)).toBeHidden();
      }
    }
  });
});
