import { expect, test } from "@playwright/test";

/** Trình duyệt phải giải mã được favicon (ICO chứa PNG tự đóng gói) và logo header. */
test("favicon và logo header hiển thị được", async ({ page }) => {
  await page.goto("/");
  const decoded = await page.evaluate(async () => {
    const load = (src: string) =>
      new Promise<number>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img.naturalWidth);
        img.onerror = () => resolve(0);
        img.src = src;
      });
    return {
      ico: await load("/favicon.ico"),
      png: await load("/favicon-32x32.png"),
      apple: await load("/apple-touch-icon.png"),
    };
  });
  expect(decoded.ico).toBeGreaterThan(0);
  expect(decoded.png).toBe(32);
  expect(decoded.apple).toBe(180);

  const logo = page.locator("header img").first();
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const box = await logo.boundingBox();
  expect(box?.width).toBe(32);
  expect(box?.height).toBe(32);
  await page.locator("header").screenshot({ path: `test-results/screens/header-${test.info().project.name}.png` });
});
