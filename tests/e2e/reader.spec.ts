import { expect, test, type Page } from "@playwright/test";

const CHAPTER = "/truyen/tien-nghich/chuong/28/";
const openSettings = async (page: Page) => {
  await page.locator("[data-open-settings]").filter({ visible: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Cài đặt đọc" });
  await expect(dialog).toBeVisible();
  return dialog;
};
const readerFontSize = (page: Page) =>
  page.locator("[data-reader]").evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

test("cỡ chữ mặc định 18–20px, giãn dòng 1.65–1.85", async ({ page }) => {
  await page.goto(CHAPTER);
  const size = await readerFontSize(page);
  expect(size).toBeGreaterThanOrEqual(18);
  expect(size).toBeLessThanOrEqual(20);
  const ratio = await page.locator("[data-reader]").evaluate((el) => {
    const style = getComputedStyle(el);
    return Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize);
  });
  expect(ratio).toBeGreaterThanOrEqual(1.65);
  expect(ratio).toBeLessThanOrEqual(1.85);
});

test("đổi cỡ chữ, giãn dòng, nền – giữ sau reload, áp dụng trước khi vẽ", async ({ page }) => {
  await page.goto(CHAPTER);
  const before = await readerFontSize(page);
  const dialog = await openSettings(page);
  await dialog.getByRole("button", { name: "Tăng cỡ chữ" }).click();
  await dialog.getByRole("button", { name: "Tăng cỡ chữ" }).click();
  await dialog.getByRole("button", { name: "Tăng giãn dòng" }).click();
  await dialog.getByText("Tối", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  const after = await readerFontSize(page);
  expect(after).toBe(Math.round(before) + 2);

  // Ghi lại theme ngay khi HTML vừa parse xong (trước script module) để chắc chắn không nháy.
  await page.addInitScript(() => {
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "interactive") {
        (window as unknown as { __themeAtParse: string | undefined }).__themeAtParse = document.documentElement.dataset.theme;
      }
    });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { __themeAtParse?: string }).__themeAtParse)).toBe("dark");
  expect(await readerFontSize(page)).toBe(after);

  const again = await openSettings(page);
  await again.getByText("Sepia", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "sepia");
  await again.getByRole("button", { name: "Đặt lại mặc định" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-choice", "system");
  expect(await readerFontSize(page)).toBe(before);
});

test("Đọc tiếp: lưu chương + đoạn văn, khôi phục khi bấm nút", async ({ page }) => {
  await page.goto(CHAPTER);
  await page.locator("[data-reader] > p").nth(40).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(1300);

  await page.goto("/");
  const cta = page.locator("a[data-continue-slug=tien-nghich]");
  await expect(cta).toHaveText(/Đọc tiếp · Chương 28/);
  await expect(cta).toHaveAttribute("href", "/truyen/tien-nghich/chuong/28/#doc-tiep");
  await cta.click();
  await expect(page).toHaveURL(/\/chuong\/28\/$/);
  const top = await page.locator("[data-reader] > p").nth(40).evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(top)).toBeLessThan(120);
});

test("dữ liệu localStorage hỏng không làm lỗi trang", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("nv:progress:v1", "{hỏng");
    localStorage.setItem("nv:reader:v1", '{"fontSize":"abc","lineHeight":99}');
    localStorage.setItem("nv:theme", "hong");
  });
  await page.goto("/");
  await expect(page.locator("a[data-continue-slug=tien-nghich]")).toHaveText(/Bắt đầu đọc/);
  await page.goto(CHAPTER);
  await expect(page.locator("html")).toHaveAttribute("data-theme-choice", "system");
  await expect(page.locator("[data-reader] p").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("phím ← → chuyển chương", async ({ page, isMobile }) => {
  test.skip(isMobile, "Bàn phím vật lý chỉ áp dụng desktop");
  await page.goto(CHAPTER);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/chuong\/29\/$/);
  await page.waitForLoadState("load"); // script trang mới đã chạy
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/\/chuong\/28\/$/);
});

test("Network: trang đọc không kéo nội dung chương khác ngoài prefetch chương kế tiếp", async ({ page, browserName }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto(CHAPTER);
  await page.waitForLoadState("load");
  await page.waitForTimeout(4500);
  const chapters = requests.filter((path) => /\/chuong\/\d+\//.test(path));
  const others = chapters.filter((path) => path !== CHAPTER);
  expect(others.length).toBeLessThanOrEqual(1);
  if (others.length) expect(others[0]).toBe("/truyen/tien-nghich/chuong/29/");
  expect(requests.some((path) => path.endsWith(".txt") || path.includes("search-index"))).toBe(false);
  test.info().annotations.push({ type: "requests", description: `${browserName}: ${requests.join(", ")}` });
});

test.describe("tắt JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("đọc, chuyển chương, mục lục vẫn dùng được", async ({ page }) => {
    await page.goto("/truyen/tien-nghich/chuong/68/");
    await expect(page.locator("[data-reader] p").first()).toBeVisible();
    await expect(page.locator("[data-open-settings]").filter({ visible: true })).toHaveCount(0);
    await page.locator("a[rel=next]").filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/chuong\/70\/$/);

    await page.goto("/truyen/tien-nghich/");
    await expect(page.locator("form[data-chapter-jump]")).toBeHidden();
    await page.getByText("Chọn khoảng chương").click();
    await page.getByRole("link", { name: "1051–1100" }).click();
    await expect(page).toHaveURL(/\/muc-luc\/22\/$/);
    await page.locator("#chuong-1060 a").click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Chương 1060");

    await page.goto("/truyen/");
    await expect(page.locator("[data-novel-card]")).toHaveCount(1);
  });
});

test("mở thoáng chương khác (không cuộn) không ghi đè vị trí Đọc tiếp", async ({ page }) => {
  await page.goto(CHAPTER);
  await page.locator("[data-reader] > p").nth(20).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(1300);
  await page.goto("/truyen/tien-nghich/chuong/2088/");
  await page.waitForTimeout(500);
  await page.goto("/");
  await expect(page.locator("a[data-continue-slug=tien-nghich]")).toHaveText(/Đọc tiếp · Chương 28/);
});

test("màu thanh trình duyệt theo nền đã chọn ngay khi tải trang", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("nv:theme", "sepia"));
  await page.goto(CHAPTER);
  const colors = await page.locator('meta[name="theme-color"]').evaluateAll((metas) => metas.map((m) => (m as HTMLMetaElement).content));
  expect(colors).toEqual(["#f3e8d0", "#f3e8d0"]);
});
