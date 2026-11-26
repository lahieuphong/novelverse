/**
 * Đổi nút "Bắt đầu đọc" thành "Đọc tiếp · Chương N" khi đã có tiến độ cho truyện.
 * Liên kết kèm #doc-tiep để trang đọc khôi phục vị trí đoạn văn.
 */
import { readAllProgress, RESUME_HASH } from "@/lib/client/progress";


export function initContinueButtons(root: ParentNode = document): void {
  const links = root.querySelectorAll<HTMLAnchorElement>("a[data-continue-slug]");
  if (links.length === 0) return;
  const progress = readAllProgress();
  links.forEach((link) => {
    const slug = link.dataset.continueSlug ?? "";
    const base = link.dataset.continueBase ?? "";
    const entry = progress[slug];
    if (!entry || !base) return;
    link.href = `${base}${entry.chapter}/#${RESUME_HASH}`;
    const label = link.querySelector<HTMLElement>("[data-continue-label]");
    if (label) label.textContent = `Đọc tiếp · Chương ${entry.chapter}`;
    link.title = entry.label;
  });
}
