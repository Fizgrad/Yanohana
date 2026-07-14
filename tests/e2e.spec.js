import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("yanohana-e2e-initialized")) {
      localStorage.clear();
      sessionStorage.setItem("yanohana-e2e-initialized", "true");
    }
  });
});

test("Japanese and English storefronts expose all products", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-home-products] .home-product")).toHaveCount(10);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("一輪ずつ");
  await page.screenshot({ path: "/tmp/yanohana-home-desktop.png", fullPage: true });
  await page.locator("[data-language-toggle]").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every flower");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/products/index.html");
  await expect(page.locator("[data-products-grid] .product-card")).toHaveCount(10);
  await expect(page.getByRole("button", { name: "Fan goods" })).toBeVisible();
});

test("customer can compose flowers, edit options and submit a request", async ({ page }) => {
  await page.goto("/products/customize.html?id=bouquet-007");
  await expect(page.locator("[data-preview-thumbs] .preview-thumb")).toHaveCount(3);
  await page.locator("[data-flower-groups] button[data-action=add]").first().click();
  await page.locator("[data-flower-groups] button[data-action=increase]").first().click();
  await expect(page.locator("[data-composition-list] .composition-item")).toHaveCount(1);
  await page.locator("#wrapping-pink").check();
  await page.locator("#ribbon-beige").check();
  await page.locator(".toggle-row").click();
  await expect(page.locator("[data-message-card]")).toBeChecked();
  await expect(page.locator("[data-add-cart]")).toBeEnabled();
  await page.locator("[data-add-cart]").click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");

  await page.goto("/cart.html");
  await expect(page.locator(".cart-item")).toHaveCount(1);
  await page.getByRole("link", { name: "お届け先の入力へ" }).click();
  await page.locator("#fullName").fill("山田 花子");
  await page.locator("#furigana").fill("ヤマダ ハナコ");
  await page.locator("#phone").fill("09012345678");
  await page.locator("#postalCode").fill("1500001");
  await page.locator("#address").fill("東京都渋谷区神宮前1-1-1");
  await page.locator("#email").fill("hanako@example.com");
  await page.locator("[data-submit]").click();
  await expect(page).toHaveURL(/order-complete\.html/);
  await expect(page.locator("[data-order-number]")).toContainText("YNH-");
});

test("mobile customization keeps the primary action reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products/customize.html?id=bouquet-003");
  await expect(page.locator(".mobile-cart-bar")).toBeVisible();
  await expect(page.locator("[data-mobile-add]")).toBeDisabled();
  await page.locator("[data-flower-groups] button[data-action=add]").first().click();
  await expect(page.locator("[data-mobile-add]")).toBeEnabled();
  await page.screenshot({ path: "/tmp/yanohana-customize-mobile.png", fullPage: true });
});
