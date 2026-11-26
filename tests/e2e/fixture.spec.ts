import { expect, test } from "@playwright/test";

/** Chạy trên dist-fixture (npm run build:fixture): danh mục chính + truyện thử nghiệm. */
test("truyện thứ hai xuất hiện chỉ nhờ thêm thư mục dữ liệu", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "Thư viện" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Mới cập nhật" })).toBeVisible();
  await expect(page.locator("[data-novel-card][data-slug=truyen-thu-nghiem]")).toBeVisible();

  await page.goto("/truyen/");
  await expect(page.locator("[data-novel-card]")).toHaveCount(2);
  await page.waitForSelector("astro-island:not([ssr])");
  await page.getByRole("searchbox").fill("thu nghiem");
  await expect(page.locator("[data-novel-card][data-slug=truyen-thu-nghiem]")).toBeVisible();
  await expect(page.locator("[data-novel-card][data-slug=tien-nghich]")).toBeHidden();
});

test("trang truyện fixture: ảnh bìa responsive, mục lục đánh dấu chương thiếu", async ({ page }) => {
  await page.goto("/truyen/truyen-thu-nghiem/");
  const cover = page.locator("main img").first();
  await expect(cover).toHaveAttribute("width", /\d+/);
  await expect(cover).toHaveAttribute("height", /\d+/);
  await expect(cover).toHaveAttribute("srcset", /webp/);
  await expect(cover).toHaveAttribute("loading", "eager");
  await expect(page.locator("#chuong-3")).toContainText("Chưa có dữ liệu");
  await expect(page.locator("#chuong-4")).toContainText("Chưa cập nhật");
  await expect(page.locator("#chuong-5")).toContainText("Lệch số");
});

test("chương fixture: BOM/CRLF, câu gãy được nối, ngắt dòng bài thơ được giữ", async ({ page }) => {
  await page.goto("/truyen/truyen-thu-nghiem/chuong/1/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chương 1: Khởi đầu");
  const paragraphs = page.locator("[data-reader] > p");
  await expect(paragraphs).toHaveCount(4);
  await expect(paragraphs.first()).toHaveText("Sáng sớm, sương mù phủ kín cả thung lũng phía sau núi.");
  await expect(paragraphs.nth(3).locator("br")).toHaveCount(2);

  await page.goto("/truyen/truyen-thu-nghiem/chuong/2/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chương 2");
  const nav = page.getByRole("navigation", { name: "Chương trước và chương sau" });
  await expect(nav.locator("a[rel=next]")).toHaveAttribute("href", "/truyen/truyen-thu-nghiem/chuong/5/");
  await expect(nav).toContainText("Chương 3 chưa có trong dữ liệu nguồn; Chương 4 chưa cập nhật nội dung nên chương sau là Chương 5.");
});
