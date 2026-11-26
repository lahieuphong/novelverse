/** Trang 404: nếu URL là một chương của truyện có trong thư viện, giải thích và đưa về đúng mục lục. */

interface NovelHint {
  slug: string;
  title: string;
  first: number;
  last: number;
  missing: Array<[number, number]>;
  unavailable: Array<[number, number]>;
  novelUrl: string;
  tocBase: string;
  chapterBase: string;
}

interface NotFoundData {
  base: string;
  pageSize: number;
  novels: NovelHint[];
}

const inRanges = (ranges: Array<[number, number]>, n: number) => ranges.some(([a, b]) => n >= a && n <= b);

export function describeNotFound(pathname: string, data: NotFoundData): { title: string; message: string; href: string; label: string } | null {
  const path = pathname.startsWith(data.base) ? pathname.slice(data.base.length) : pathname.replace(/^\//, "");
  const match = /^truyen\/([a-z0-9-]+)(?:\/(chuong|muc-luc)\/(\d+))?/.exec(path);
  if (!match) return null;
  const novel = data.novels.find((item) => item.slug === match[1]);
  if (!novel) return null;
  const kind = match[2];
  const number = match[3] ? Number.parseInt(match[3], 10) : null;

  if (kind === "chuong" && number !== null && number >= novel.first && number <= novel.last) {
    const unavailable = inRanges(novel.unavailable, number);
    const missing = inRanges(novel.missing, number);
    if (!unavailable && !missing) {
      // Chương có thật nhưng URL gõ sai (số 0 ở đầu, thừa đoạn sau…): đưa thẳng tới chương.
      return {
        title: `Có phải bạn muốn đọc Chương ${number}?`,
        message: `Đường dẫn chưa đúng, nhưng Chương ${number} của ${novel.title} vẫn đọc được.`,
        href: `${novel.chapterBase}${number}/`,
        label: `Đọc Chương ${number}`,
      };
    }
    const page = Math.floor((number - novel.first) / data.pageSize) + 1;
    const reason = unavailable ? "chưa được cập nhật nội dung" : "chưa có trong dữ liệu nguồn";
    return {
      title: `Chương ${number} chưa đọc được`,
      message: `Chương ${number} của ${novel.title} ${reason}. Bạn có thể chọn chương khác trong mục lục.`,
      href: `${novel.tocBase}${page}/#chuong-${number}`,
      label: "Xem mục lục",
    };
  }
  if (kind === "chuong" && number !== null) {
    const hasChapters = novel.last >= novel.first;
    return {
      title: `Không có chương ${number}`,
      message: hasChapters ? `${novel.title} hiện có chương ${novel.first}–${novel.last}.` : `${novel.title} chưa có chương nào.`,
      href: hasChapters ? `${novel.tocBase}1/` : novel.novelUrl,
      label: hasChapters ? "Xem mục lục" : `Về trang ${novel.title}`,
    };
  }
  return {
    title: "Không tìm thấy trang",
    message: `Trang này không thuộc ${novel.title}. Quay về trang truyện để tiếp tục đọc.`,
    href: novel.novelUrl,
    label: `Về trang ${novel.title}`,
  };
}

export function initNotFound(): void {
  const script = document.getElementById("nv-404-data");
  if (!script?.textContent) return;
  let data: NotFoundData;
  try {
    data = JSON.parse(script.textContent) as NotFoundData;
  } catch {
    return;
  }
  const result = describeNotFound(window.location.pathname, data);
  if (!result) return;
  const title = document.querySelector("[data-nf-title]");
  const message = document.querySelector("[data-nf-message]");
  const primary = document.querySelector<HTMLAnchorElement>("[data-nf-primary]");
  const label = document.querySelector("[data-nf-primary-label]");
  if (title) title.textContent = result.title;
  if (message) message.textContent = result.message;
  if (primary) primary.href = result.href;
  if (label) label.textContent = result.label;
  document.title = `${result.title} | NovelVerse`;
}
