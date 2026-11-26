import { expect, test } from "@playwright/test";

test("tìm theo tên/tác giả, có dấu và không dấu, trạng thái không có kết quả", async ({ page }) => {
  const indexRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("search-index.json")) indexRequests.push(request.url());
  });
  await page.goto("/truyen/");
  await page.waitForSelector("astro-island:not([ssr])");
  expect(indexRequests).toHaveLength(0); // chỉ tải khi người dùng bắt đầu tìm

  const input = page.getByRole("searchbox", { name: "Tìm theo tên truyện hoặc tác giả" });
  const card = page.locator("[data-novel-card][data-slug=tien-nghich]");

  await input.fill("tien nghich");
  await expect(page.getByText("Tìm thấy 1 truyện")).toBeVisible();
  await expect(card).toBeVisible();
  expect(indexRequests).toHaveLength(1);

  await input.fill("Nhĩ Căn");
  await expect(card).toBeVisible();

  await input.fill("khong co truyen nay");
  await expect(page.getByText("Không tìm thấy truyện phù hợp")).toBeVisible();
  await expect(page.locator("#library-grid")).toBeHidden();
  await expect(page).toHaveURL(/\?q=khong\+co\+truyen\+nay$/);

  await page.getByRole("button", { name: "Xóa từ khóa" }).click();
  await expect(input).toHaveValue("");
  await expect(card).toBeVisible();
});

test("?q= trên URL được áp dụng sau khi tải", async ({ page }) => {
  await page.goto("/truyen/?q=nhi%20can");
  await expect(page.getByRole("searchbox")).toHaveValue("nhi can");
  await expect(page.getByText("Tìm thấy 1 truyện")).toBeVisible();
});

test("nút tìm ở header đưa tới ô tìm và focus", async ({ page }) => {
  await page.goto("/truyen/tien-nghich/chuong/28/");
  await page.getByRole("link", { name: "Tìm truyện" }).click();
  await expect(page).toHaveURL(/\/truyen\/#tim-kiem$/);
  await expect(page.getByRole("searchbox")).toBeFocused();
});

test("chữ gõ trước khi ô tìm kiếm hydrate xong không bị mất", async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/_astro\/LibrarySearch\.[^/]+\.js$/, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/truyen/", { waitUntil: "domcontentloaded" });
  await page.getByRole("searchbox").fill("nhi can");
  release();
  await expect(page.getByText("Tìm thấy 1 truyện")).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveValue("nhi can");
});
