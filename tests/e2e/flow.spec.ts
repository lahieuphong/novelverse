import { expect, test, type Page } from "@playwright/test";

const reader = (page: Page) => page.locator("[data-reader]");
const visibleLink = (page: Page, rel: "next" | "prev") => page.locator(`a[rel=${rel}]`).filter({ visible: true }).first();
const endNav = (page: Page) => page.getByRole("navigation", { name: "Chương trước và chương sau" });

test("trang chủ → truyện → mục lục → chương", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "Tiên Nghịch" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bắt đầu đọc" })).toHaveAttribute("href", "/truyen/tien-nghich/chuong/1/");

  await page.getByRole("link", { name: "Xem mục lục" }).click();
  await expect(page).toHaveURL(/\/truyen\/tien-nghich\/#muc-luc$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tiên Nghịch" })).toBeVisible();
  await expect(page.locator("[data-chapter-list] li")).toHaveCount(50);

  await page.getByRole("navigation", { name: "Phân trang mục lục" }).getByRole("link", { name: "Sau" }).click();
  await expect(page).toHaveURL(/\/truyen\/tien-nghich\/muc-luc\/2\/$/);
  await expect(page.locator("#chuong-69")).toContainText("Chưa có dữ liệu");
  await expect(page.locator("#chuong-69 a")).toHaveCount(0);

  await page.locator("#chuong-70 a").click();
  await expect(page).toHaveURL(/\/truyen\/tien-nghich\/chuong\/70\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chương 70: Hồi Gia");
  await expect(reader(page).locator("p").first()).not.toBeEmpty();
});

test("deep link, reload, Back/Forward không bị tự chuyển chương", async ({ page }) => {
  await page.goto("/truyen/tien-nghich/chuong/28/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chương 28: Tạp vụ");
  await expect(reader(page).locator("p").first()).toContainText("Tử, hắc, bạch, hồng");
  await page.reload();
  await expect(page).toHaveURL(/\/chuong\/28\/$/);

  await visibleLink(page, "next").click();
  await expect(page).toHaveURL(/\/chuong\/29\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/chuong\/28\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chương 28: Tạp vụ");
  await page.goForward();
  await expect(page).toHaveURL(/\/chuong\/29\/$/);

  // Mở trực tiếp một chương khác: giữ nguyên URL dù đã có tiến độ ở chương 29.
  await page.goto("/truyen/tien-nghich/chuong/500/");
  await expect(page).toHaveURL(/\/chuong\/500\/$/);
});

test("68 ↔ 70 và 438 ↔ 440 bỏ qua chương thiếu, có giải thích", async ({ page }) => {
  await page.goto("/truyen/tien-nghich/chuong/68/");
  await expect(endNav(page).locator("a[rel=next]")).toHaveAttribute("href", "/truyen/tien-nghich/chuong/70/");
  await expect(endNav(page)).toContainText("Chương 69 chưa có trong dữ liệu nguồn nên chương sau là Chương 70.");

  await page.goto("/truyen/tien-nghich/chuong/70/");
  await expect(endNav(page).locator("a[rel=prev]")).toHaveAttribute("href", "/truyen/tien-nghich/chuong/68/");
  await expect(endNav(page)).toContainText("Chương 69 chưa có trong dữ liệu nguồn nên chương trước là Chương 68.");

  await page.goto("/truyen/tien-nghich/chuong/438/");
  await expect(endNav(page).locator("a[rel=next]")).toHaveAttribute("href", "/truyen/tien-nghich/chuong/440/");
  await page.goto("/truyen/tien-nghich/chuong/440/");
  await expect(endNav(page).locator("a[rel=prev]")).toHaveAttribute("href", "/truyen/tien-nghich/chuong/438/");
});

test("1105 → 1110 nhảy qua 1106–1109 chưa cập nhật", async ({ page }) => {
  await page.goto("/truyen/tien-nghich/chuong/1105/");
  await expect(endNav(page).locator("a[rel=next]")).toHaveAttribute("href", "/truyen/tien-nghich/chuong/1110/");
  await expect(endNav(page)).toContainText("Chương 1106–1109 chưa cập nhật nội dung nên chương sau là Chương 1110.");
  await visibleLink(page, "next").click();
  await expect(page).toHaveURL(/\/chuong\/1110\/$/);
  await expect(endNav(page).locator("a[rel=prev]")).toHaveAttribute("href", "/truyen/tien-nghich/chuong/1105/");

  await page.goto("/truyen/tien-nghich/muc-luc/23/");
  for (const n of [1106, 1107, 1108, 1109]) {
    await expect(page.locator(`#chuong-${n}`)).toContainText("Chưa cập nhật");
    await expect(page.locator(`#chuong-${n} a`)).toHaveCount(0);
  }
});

test("chương đầu không có 'trước', chương cuối không có 'sau'", async ({ page }) => {
  await page.goto("/truyen/tien-nghich/chuong/1/");
  await expect(page.locator("a[rel=prev]")).toHaveCount(0);
  await page.goto("/truyen/tien-nghich/chuong/2088/");
  await expect(page.locator("a[rel=next]")).toHaveCount(0);
  await expect(endNav(page)).toContainText("Bạn đã đọc tới chương cuối hiện có.");
});

test("URL chương thiếu/chưa cập nhật trả 404 có lối về mục lục", async ({ page }) => {
  const missing = await page.goto("/truyen/tien-nghich/chuong/69/");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chương 69 chưa đọc được");
  await expect(page.getByText("chưa có trong dữ liệu nguồn")).toBeVisible();
  const back = page.getByRole("link", { name: "Xem mục lục" });
  await expect(back).toHaveAttribute("href", "/truyen/tien-nghich/muc-luc/2/#chuong-69");
  await back.click();
  await expect(page).toHaveURL(/\/muc-luc\/2\/#chuong-69$/);
  await expect(page.locator("#chuong-69")).toBeInViewport();

  const placeholder = await page.goto("/truyen/tien-nghich/chuong/1106/");
  expect(placeholder?.status()).toBe(404);
  await expect(page.getByText("chưa được cập nhật nội dung")).toBeVisible();
  await expect(page.getByRole("link", { name: "Xem mục lục" })).toHaveAttribute("href", "/truyen/tien-nghich/muc-luc/23/#chuong-1106");

  const other = await page.goto("/khong-co-trang-nay/");
  expect(other?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Không tìm thấy trang");
  await expect(page.getByRole("link", { name: "Vào thư viện" })).toBeVisible();
});

test("ô 'Đi tới chương' mở chương hoặc mục lục tại chương thiếu", async ({ page }) => {
  await page.goto("/truyen/tien-nghich/");
  const input = page.getByLabel("Đi tới chương");
  await input.fill("1500");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/chuong\/1500\/$/);

  await page.goto("/truyen/tien-nghich/");
  await page.getByLabel("Đi tới chương").fill("439");
  await page.getByRole("button", { name: "Đi", exact: true }).click();
  await expect(page).toHaveURL(/\/muc-luc\/9\/#chuong-439$/);

  await page.goto("/truyen/tien-nghich/");
  await page.getByLabel("Đi tới chương").fill("5000");
  await page.getByRole("button", { name: "Đi", exact: true }).click();
  await expect(page.getByText("Nhập số chương từ 1 đến 2088.")).toBeVisible();
});
