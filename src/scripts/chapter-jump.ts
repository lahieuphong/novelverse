/** Ô "Đi tới chương": chương có nội dung -> mở chương; chương thiếu -> mở mục lục tại vị trí đó. */

function parseRanges(value: string): Array<[number, number]> {
  return value
    .split(",")
    .filter(Boolean)
    .map((part) => {
      const [a, b] = part.split("-").map((n) => Number.parseInt(n, 10));
      return [a ?? 0, b ?? a ?? 0] as [number, number];
    });
}

export function initChapterJump(form: HTMLFormElement): void {
  const input = form.querySelector<HTMLInputElement>("input[name=chuong]");
  const message = form.querySelector<HTMLElement>("[data-jump-message]");
  if (!input || !message) return;

  const first = Number(form.dataset.first);
  const last = Number(form.dataset.last);
  const pageSize = Number(form.dataset.pageSize) || 50;
  const unavailable = parseRanges(form.dataset.unavailable ?? "");
  const chapterBase = form.dataset.chapterBase ?? "";
  const tocBase = form.dataset.tocBase ?? "";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const number = Number.parseInt(input.value, 10);
    if (!Number.isFinite(number) || number < first || number > last) {
      message.textContent = `Nhập số chương từ ${first} đến ${last}.`;
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    input.removeAttribute("aria-invalid");
    if (unavailable.some(([a, b]) => number >= a && number <= b)) {
      const page = Math.floor((number - first) / pageSize) + 1;
      message.textContent = `Chương ${number} chưa có nội dung – đang mở mục lục tại vị trí này.`;
      window.location.assign(`${tocBase}${page}/#chuong-${number}`);
      return;
    }
    window.location.assign(`${chapterBase}${number}/`);
  });
}
