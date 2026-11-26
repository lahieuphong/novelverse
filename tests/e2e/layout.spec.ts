import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = {
  home: "/",
  library: "/truyen/",
  novel: "/truyen/tien-nghich/",
  toc: "/truyen/tien-nghich/muc-luc/23/",
  chapter: "/truyen/tien-nghich/chuong/1105/",
  notfound: "/truyen/tien-nghich/chuong/69/",
};

// 640 ≈ cửa sổ 1280px phóng to 200%. 844×390 = điện thoại xoay ngang.
const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 640, height: 800 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
];

for (const viewport of VIEWPORTS) {
  test(`không cuộn ngang ở ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const [name, url] of Object.entries(PAGES)) {
      await page.goto(url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${name} tràn ngang ${overflow}px`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/screens/${name}-${viewport.width}x${viewport.height}.png` });
    }
  });
}

test("cột đọc ≤ 72ch trên màn hình rộng", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PAGES.chapter);
  const { width, ch } = await page.locator("[data-reader]").evaluate((el) => {
    const probe = document.createElement("span");
    probe.textContent = "0";
    el.append(probe);
    const result = { width: el.getBoundingClientRect().width, ch: probe.getBoundingClientRect().width };
    probe.remove();
    return result;
  });
  expect(width / ch).toBeGreaterThanOrEqual(60);
  expect(width / ch).toBeLessThanOrEqual(72);
});

test("mobile: thanh điều hướng không che đoạn cuối, nút ≥ 44px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PAGES.chapter);
  const bar = page.getByRole("navigation", { name: "Điều hướng chương (thanh dưới)" });
  await expect(bar).toBeVisible();
  for (const box of await bar.locator("a, button").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) {
    expect(box).toBeGreaterThanOrEqual(44);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const barTop = await bar.evaluate((el) => el.getBoundingClientRect().top);
  const lastParagraphBottom = await page.locator("[data-reader] > p").last().evaluate((el) => el.getBoundingClientRect().bottom);
  const footerBottom = await page.locator("footer").evaluate((el) => el.getBoundingClientRect().bottom);
  expect(lastParagraphBottom).toBeLessThanOrEqual(barTop);
  expect(footerBottom).toBeLessThanOrEqual(barTop + 1);
});

test("bàn phím: liên kết bỏ qua là điểm focus đầu tiên và có viền focus rõ", async ({ page }) => {
  await page.goto(PAGES.chapter);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Bỏ qua tới nội dung chính" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const style = getComputedStyle(el);
    return { width: Number.parseFloat(style.outlineWidth), style: style.outlineStyle };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
});

for (const theme of ["light", "dark", "sepia"] as const) {
  test(`axe: không vi phạm WCAG A/AA ở nền ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => {
      if (value !== "light") localStorage.setItem("nv:theme", value);
      else localStorage.setItem("nv:theme", "light");
    }, theme);
    for (const [name, url] of Object.entries(PAGES)) {
      await page.goto(url);
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const summary = result.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      expect(summary, `${name} (${theme})`).toEqual([]);
    }
  });
}

test("ảnh chụp: hộp cài đặt trên mobile và các nền đọc", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PAGES.chapter);
  await page.locator("[data-open-settings]").filter({ visible: true }).first().click();
  await page.getByText("Tối", { exact: true }).click();
  await page.waitForTimeout(400); // chờ hiệu ứng đổi màu nút
  await page.screenshot({ path: "test-results/screens/settings-dark-390.png" });
  await page.getByText("Sepia", { exact: true }).click();
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "test-results/screens/chapter-sepia-390.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/truyen/tien-nghich/chuong/68/");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.screenshot({ path: "test-results/screens/chapter68-end-sepia-1440.png" });
});

test("footer nằm sát đáy màn hình ở trang ngắn, sau nội dung ở trang dài", async ({ page }) => {
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const url of [PAGES.library, PAGES.notfound]) {
      await page.goto(url);
      const bottom = await page.locator("body > footer").evaluate((el) => el.getBoundingClientRect().bottom);
      expect(Math.round(bottom), `${url} @${viewport.width}`).toBe(viewport.height);
    }
    await page.goto(PAGES.chapter);
    const footerTop = await page.locator("body > footer").evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const mainBottom = await page.locator("main").evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);
    expect(footerTop).toBeGreaterThanOrEqual(mainBottom - 1);
  }
});
