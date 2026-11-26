# NovelVerse

Website đọc truyện chữ tiếng Việt, dựng tĩnh (Astro) từ các thư mục truyện trong repo. Mỗi chương là một trang HTML có sẵn nội dung, đọc được cả khi tắt JavaScript. Danh mục tự mở rộng khi thêm thư mục truyện mới; giao diện, route và điều hướng dùng chung cho mọi truyện.

Stack: Astro 7 (static) · TypeScript strict · Tailwind CSS 4 · shadcn/ui (Button, Input, Skeleton) · React chỉ cho ô tìm kiếm ở `/truyen`.

## Chạy local

Yêu cầu Node.js ≥ 22.23.4.

```bash
npm install
npm run dev              # http://localhost:4321 – xem trước khi đang sửa
npm run build            # kiểm tra nội dung + build ra dist/
npm run serve            # phục vụ dist/ như host tĩnh: http://127.0.0.1:4322
```

| Lệnh | Việc |
| --- | --- |
| `npm run content:check` | Kiểm tra cây thư mục truyện (`-- --verbose`, `-- --json`, `-- --write-schema`) |
| `npm run typecheck` | `astro check` + `tsc --noEmit` |
| `npm test` | Unit test (vitest) |
| `npm run build` | Build production ra `dist/` (tự chạy kiểm tra nội dung trước) |
| `npm run serve` / `npm run preview` | Phục vụ `dist/` (serve: có 404.html + gzip; preview: `astro preview`) |
| `npm run build:fixture` / `npm run preview:fixture` | Bản thử có thêm truyện giả trong `tests/fixtures/novels` ra `dist-fixture/` |
| `npm run test:e2e` | Playwright trên bản build (cần `build` + `build:fixture` trước) |
| `npm run verify` | content:check → typecheck → test → build |
| `node scripts/generate-icons.ts` | Sinh lại favicon (`public/favicon.ico`, `favicon-32x32.png`, `apple-touch-icon.png`) từ `src/assets/brand/logo.webp` |

Logo ở header và favicon lấy từ `src/assets/brand/logo.webp` (ảnh vuông). Đổi logo: thay file đó rồi chạy `node scripts/generate-icons.ts`.

Khi `npm run dev` đang chạy, thêm/sửa/xóa truyện hoặc chương sẽ tự quét lại danh mục và tải lại trang.

URL mẫu: `/`, `/truyen/`, `/truyen/tien-nghich/`, `/truyen/tien-nghich/muc-luc/2/`, `/truyen/tien-nghich/chuong/1/`.

## Cấu trúc

```
content/
  novel.schema.json          JSON Schema cho novel.json (sinh từ schema zod)
  novels/
    tien-nghich/novel.json   metadata; chaptersDir trỏ tới ../../../chuong
chuong/                      2.086 file chương Tiên Nghịch (giữ nguyên, dùng chung với công cụ Python)
cau-hoi/                     bộ câu hỏi – không liên quan tới website, không bị đóng gói
scan_tien_nghich.py, crawl_truyendich.py   công cụ thu thập (website không chạy crawler)
src/
  pages/                     index, 404, truyen/, truyen/[slug]/, muc-luc/[page], chuong/[number],
                             search-index.json, sitemap.xml (khi có SITE_URL), robots.txt
  layouts/BaseLayout.astro   <head>, SEO, script áp theme trước khi vẽ
  components/                novels/ (bìa, thẻ, mục lục…), reader/ (điều hướng chương), search/, ui/ (shadcn)
  lib/content/               đọc dữ liệu ở build: schema, loader, xử lý văn bản, catalog, báo cáo
  lib/client/                localStorage an toàn: tiến độ đọc, cài đặt đọc
  scripts/                   JS nhỏ cho trang đọc, Đọc tiếp, Đi tới chương, 404
  integrations/content-check.ts   chạy kiểm tra nội dung khi build
  styles/global.css          token màu (Sáng/Tối/Sepia), kiểu chữ trang đọc
scripts/                     check-content.ts, build-fixture.ts, serve-static.ts
tests/unit, tests/e2e, tests/fixtures/novels/truyen-thu-nghiem
```

## Thêm truyện mới

1. Tạo thư mục `content/novels/<slug>/` (slug: chữ thường không dấu, số, gạch ngang – ví dụ `pham-nhan-tu-tien`). Slug là URL `/truyen/<slug>/`, không nên đổi sau khi đã xuất bản.
2. Tạo `content/novels/<slug>/novel.json`:

   ```json
   {
     "$schema": "../../novel.schema.json",
     "slug": "pham-nhan-tu-tien",
     "title": "Phàm Nhân Tu Tiên",
     "altTitles": ["凡人修仙传"],
     "author": "Vong Ngữ",
     "genres": ["Tiên hiệp"],
     "status": "completed",
     "description": "Mô tả ngắn. Xuống đoạn bằng một dòng trống (\\n\\n).",
     "cover": "cover.jpg",
     "updatedAt": "2026-11-26",
     "source": { "name": "Tên nguồn", "url": "https://…" }
   }
   ```

   | Trường | Bắt buộc | Ghi chú |
   | --- | --- | --- |
   | `slug`, `title`, `author`, `genres`, `status`, `description` | có | `status`: `ongoing` · `completed` · `paused` · `dropped` |
   | `altTitles` | không | Tên khác, cũng dùng cho tìm kiếm |
   | `cover` | không | File ảnh `.jpg/.jpeg/.png/.webp/.avif` đặt **cạnh** `novel.json`. Không có thì dùng bìa chữ |
   | `chaptersDir` | không | Mặc định `chapters`. Tương đối với thư mục truyện, phải nằm trong repo |
   | `featured` | không | `true` để ưu tiên ở khu nổi bật trang chủ |
   | `updatedAt` | không | `YYYY-MM-DD`, sắp xếp mục "Mới cập nhật" |
   | `source` | không | `{ name, url?, note? }` – hiện ở trang truyện |

3. Thêm chương vào `content/novels/<slug>/chapters/`, mỗi chương một file `.txt` UTF-8.
4. `npm run content:check`, rồi `npm run dev` để xem trước. Không cần sửa code: truyện tự xuất hiện ở trang chủ, thư viện, tìm kiếm và sitemap.

## Thêm hoặc sửa chương

- **Tên file**: số chương là nhóm chữ số cuối cùng trong tên: `0001.txt`, `chuong_0001.txt`, `chapter-1.txt` đều là chương 1. Số chương chính là URL (`/chuong/1/`).
- **Nội dung**: dòng đầu là tiêu đề dạng `Chương 12: Tên chương` (hoặc `Chuong`, `Chapter`; `Hồi 12: …` cần dấu phân cách vì "Hồi" cũng là từ thường); nếu không có, trang hiện "Chương 12". Đoạn văn cách nhau bằng một dòng trống; dòng đơn trong một đoạn được giữ như ngắt dòng (thơ, thư…). Hỗ trợ BOM, LF và CRLF.
- **Câu bị cắt đôi** (nguồn xuống dòng giữa câu): được nối lại khi đoạn trước không kết thúc bằng dấu câu và đoạn sau bắt đầu bằng chữ thường; nếu chương có dấu hiệu bị ngắt dòng cứng theo độ rộng cố định, chỗ cắt trước tên riêng viết hoa cũng được nối khi dòng trước dài đúng độ rộng đó. Trên Tiên Nghịch: 13.762 chỗ nối trong 148.995 đoạn gốc.
- **Chương chưa có nội dung**: file rỗng hoặc chỉ có câu như "Chưa update", "Đang cập nhật…" được nhận diện tự động là *Chưa cập nhật*. Thiếu file ở giữa (ví dụ có 68 và 70, không có 69) là *khoảng thiếu*. Cả hai vẫn hiện trong mục lục nhưng không có link; nút chương trước/sau nhảy tới chương có nội dung gần nhất kèm câu giải thích; URL của chúng trả về trang 404 có nút về đúng vị trí trong mục lục. Khi bổ sung file, chương tự trở thành đọc được ở lần build sau.
- Với Tiên Nghịch, `scan_tien_nghich.py` vẫn ghi vào `chuong/chuong_NNNN.txt` như trước; build lại là trang cập nhật.

### Kiểm tra nội dung

`npm run content:check` (cũng chạy tự động đầu `npm run build`):

| Mức | Trường hợp | Build |
| --- | --- | --- |
| Lỗi | Trùng số chương trong một truyện, trùng slug, file không phải UTF-8, `novel.json` hỏng hoặc thiếu trường bắt buộc, thư mục chương không tồn tại hoặc nằm ngoài repo, số chương bất thường (cách chương trước hơn 1.000 hoặc lớn hơn 100.000 – thường là file lạc như `backup_20241126.txt`) | **Dừng** |
| Cảnh báo | Khoảng thiếu, chương placeholder/rỗng, tiêu đề ghi số khác tên file, file `.txt` không có số, slug khác tên thư mục, ảnh bìa không tìm thấy, thư mục truyện chưa có `novel.json` | Vẫn build |
| Thông tin | File không phải `.txt` (bị bỏ qua), chương không có dòng tiêu đề | Vẫn build |

## Xuất bản

Bản đang chạy: **https://novelverse-vn.vercel.app** (Vercel, project `novelverse`; `novelverse.vercel.app` đã thuộc người khác nên không dùng được).

```bash
npx vercel deploy --prod      # upload mã nguồn + chuong/, Vercel build bằng vercel.json
E2E_BASE_URL=https://novelverse-vn.vercel.app npx playwright test --project=chromium   # kiểm tra sau deploy
```

`vercel.json` khai báo lệnh build, `trailingSlash: true` (URL không có `/` cuối được chuyển 308) và cache dài hạn cho `/_astro/*`; `.vercelignore` loại `cau-hoi/`, script Python, log và bản build cục bộ khỏi lần upload. Biến `SITE_URL` đặt trong Production Environment Variables của project.

`dist/` cũng là site tĩnh dùng được trên host khác (Cloudflare Pages, Netlify, GitHub Pages, Nginx…). Host cần trả `404.html` cho đường dẫn không tồn tại.

- `SITE_URL=https://ten-mien` khi build: sinh canonical tuyệt đối, `sitemap.xml` (chỉ gồm URL có nội dung) và dòng Sitemap trong `robots.txt`.
- `BASE_PATH=/novelverse` nếu site nằm dưới thư mục con.
- Build chỉ đọc file cục bộ; `chuong/` và `cau-hoi/` không bị chép vào `dist/`, đường dẫn file nội bộ không xuất hiện trong HTML/JS/JSON.

> **Quyền nội dung:** chỉ dùng tùy chọn xuất bản công khai cho nội dung mà chủ repo có quyền đăng. Văn bản truyện dịch thường thuộc bản quyền của tác giả và người dịch; với nội dung chưa có quyền, chỉ build và đọc cục bộ hoặc để site/repo ở chế độ riêng tư.

## Giao diện và đọc

- Font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif` – SF Pro trên thiết bị Apple, không tải font ngoài.
- Trang đọc: cột 68ch, chữ 18–20px (co theo màn hình), giãn dòng 1,75. Cài đặt cỡ chữ (15–28px), giãn dòng, nền Theo máy/Sáng/Sepia/Tối; theme áp dụng trước khi vẽ trang.
- Tiến độ lưu theo truyện + chương + đoạn văn đầu màn hình, chỉ khi người đọc cuộn hoặc ở lại chương ≥ 20 giây (mở thoáng "Chương mới nhất" không làm mất chỗ đang đọc); nhịp ghi 1 giây, bỏ qua dữ liệu hỏng, chạy được khi localStorage bị chặn. "Đọc tiếp" khôi phục vị trí; mở link trực tiếp không bao giờ tự chuyển chương.
- Phím ← → chuyển chương. Prefetch tối đa một chương kế tiếp, chỉ khi trình duyệt báo mạng 4G và không bật tiết kiệm dữ liệu.

## Số đo (26/11/2026, Windows 11, Node 24)

| Mục | Kết quả |
| --- | --- |
| Build | 2.128 trang trong ~7 s (≈10 s cả khởi động); quét nội dung ~0,2 s |
| `dist/` | ~72 MB; trang chương trung bình ~27 KB HTML (~6,7 KB gzip) |
| JS trang đọc | ~5 KB gzip (mục tiêu ≤ 50 KB) |
| JS `/truyen` | ~80 KB gzip (React + ô tìm kiếm), chỉ trang thư viện |
| Lighthouse mobile (12.8, Moto G Power giả lập, 4G chậm, CPU ×4, `npm run serve` có gzip, localhost) | Trang chương/chủ/truyện/thư viện: Performance 100, LCP 1,2–1,7 s, CLS 0, Accessibility/Best practices/SEO 100 |

| Lighthouse mobile trên production `novelverse-vn.vercel.app` (cùng điều kiện giả lập) | Trang chương: 100 điểm, LCP 1,0 s, CLS 0, JS 5,1 KB; trang chủ: 100 điểm, LCP 0,9 s |

Throttling là giả lập của Lighthouse; chưa đo trên thiết bị và mạng di động thật.
