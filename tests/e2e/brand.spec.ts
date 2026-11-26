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

  // Favicon tròn: góc trong suốt, tâm đặc (cả bản .ico lẫn .png).
  for (const src of ["/favicon-32x32.png", "/favicon.ico"]) {
    const alpha = await page.evaluate(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 32;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 32, 32);
      return { corner: ctx.getImageData(0, 0, 1, 1).data[3], center: ctx.getImageData(16, 16, 1, 1).data[3] };
    }, src);
    expect(alpha.corner, `${src} góc`).toBe(0);
    expect(alpha.center, `${src} tâm`).toBe(255);
  }

  const logo = page.locator("header img").first();
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const box = await logo.boundingBox();
  expect(box?.width).toBe(32);
  expect(box?.height).toBe(32);
  await page.locator("header").screenshot({ path: `test-results/screens/header-${test.info().project.name}.png` });
});
