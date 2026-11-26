/**
 * Script trang đọc (JS nhỏ, không framework):
 * - lưu tiến độ theo slug + số chương + đoạn văn đầu màn hình (giới hạn nhịp ghi);
 * - khôi phục vị trí chỉ khi vào bằng liên kết "Đọc tiếp" (#doc-tiep), không tự chuyển chương;
 * - hộp cài đặt cỡ chữ / giãn dòng / nền;
 * - phím ← → để chuyển chương;
 * - prefetch tối đa một chương kế tiếp khi mạng tốt và không bật tiết kiệm dữ liệu.
 * Nội dung chương có sẵn trong HTML; mọi thứ ở đây chỉ là tăng cường.
 */
import { MAX_LABEL_LENGTH, readProgress, RESUME_HASH, writeProgress } from "@/lib/client/progress";
import {
  applySettings,
  applyTheme,
  DEFAULT_LINE_HEIGHT,
  FONT_SIZE,
  LINE_HEIGHTS,
  parseTheme,
  readSettings,
  readTheme,
  writeSettings,
  writeTheme,
  type ReaderSettings,
} from "@/lib/client/settings";
import { mountSettingsDialog } from "./settings-dialog";

const SAVE_INTERVAL_MS = 1000;
/** Ở lại trang chương (đang hiển thị) chừng này mà không cuộn thì cũng tính là đang đọc. */
const DWELL_MS = 20_000;

function initProgress(article: HTMLElement): void {
  const slug = article.dataset.slug ?? "";
  const chapter = Number(article.dataset.chapter);
  const label = (article.dataset.label ?? "").slice(0, MAX_LABEL_LENGTH);
  if (!slug || !Number.isFinite(chapter)) return;
  const paragraphs = Array.from(article.querySelectorAll<HTMLElement>(":scope > p"));

  /** Chỉ số đoạn văn đầu tiên còn nhìn thấy ở mép trên màn hình (tìm nhị phân). */
  const topParagraph = (): number => {
    let low = 0;
    let high = paragraphs.length - 1;
    let found = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const rect = paragraphs[mid]?.getBoundingClientRect();
      if (rect && rect.bottom > 8) {
        found = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return found;
  };

  const save = () => writeProgress(slug, { chapter, label, paragraph: topParagraph(), updatedAt: Date.now() });

  const saved = readProgress(slug);
  if (location.hash === `#${RESUME_HASH}`) {
    // Bỏ hash khỏi URL để reload/chia sẻ không bị khôi phục lại lần nữa.
    history.replaceState(history.state, "", location.pathname + location.search);
    if (saved && saved.chapter === chapter && saved.paragraph > 0) {
      paragraphs[Math.min(saved.paragraph, paragraphs.length - 1)]?.scrollIntoView({ block: "start" });
    }
  }

  // Chỉ ghi tiến độ khi người đọc thật sự đọc (cuộn, hoặc ở lại trang đủ lâu). Mở thoáng một chương
  // khác (ví dụ "Chương mới nhất") rồi quay lại thì vị trí "Đọc tiếp" cũ vẫn còn.
  let dwell: number | undefined;
  const stopDwell = () => {
    if (dwell !== undefined) window.clearTimeout(dwell);
    dwell = undefined;
  };
  const startDwell = () => {
    if (dwell !== undefined || document.visibilityState !== "visible") return;
    dwell = window.setTimeout(() => {
      dwell = undefined;
      save();
    }, DWELL_MS);
  };
  startDwell();

  let timer: number | undefined;
  window.addEventListener(
    "scroll",
    () => {
      stopDwell();
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        save();
      }, SAVE_INTERVAL_MS);
    },
    { passive: true },
  );
  const flush = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
      save();
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      stopDwell();
      flush();
    } else {
      startDwell();
    }
  });
  window.addEventListener("pagehide", flush);
}

function initSettings(article: HTMLElement): void {
  const dialog = mountSettingsDialog();

  let settings: ReaderSettings = readSettings();
  const fontOutput = dialog.querySelector<HTMLOutputElement>("[data-font-value]");
  const lineOutput = dialog.querySelector<HTMLOutputElement>("[data-line-value]");
  const decimal = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const currentFontSize = () => settings.fontSize ?? Math.round(Number.parseFloat(getComputedStyle(article).fontSize) || FONT_SIZE.default);
  const currentLineHeight = () => settings.lineHeight ?? DEFAULT_LINE_HEIGHT;

  const render = () => {
    if (fontOutput) fontOutput.textContent = `${currentFontSize()} px`;
    if (lineOutput) lineOutput.textContent = decimal.format(currentLineHeight());
    const theme = readTheme();
    dialog.querySelectorAll<HTMLInputElement>('input[name="reader-theme"]').forEach((input) => {
      input.checked = input.value === theme;
    });
    dialog.querySelector<HTMLButtonElement>('[data-font="dec"]')?.toggleAttribute("disabled", currentFontSize() <= FONT_SIZE.min);
    dialog.querySelector<HTMLButtonElement>('[data-font="inc"]')?.toggleAttribute("disabled", currentFontSize() >= FONT_SIZE.max);
    dialog.querySelector<HTMLButtonElement>('[data-line="dec"]')?.toggleAttribute("disabled", currentLineHeight() <= (LINE_HEIGHTS[0] ?? 1.5));
    dialog
      .querySelector<HTMLButtonElement>('[data-line="inc"]')
      ?.toggleAttribute("disabled", currentLineHeight() >= (LINE_HEIGHTS[LINE_HEIGHTS.length - 1] ?? 2.1));
  };

  const update = (next: ReaderSettings) => {
    settings = next;
    applySettings(settings);
    writeSettings(settings);
    render();
  };

  const open = () => {
    render();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  };
  const close = () => {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  };

  document.querySelectorAll<HTMLElement>("[data-open-settings]").forEach((button) => {
    button.addEventListener("click", open);
  });
  dialog.querySelectorAll<HTMLElement>("[data-close-settings]").forEach((button) => button.addEventListener("click", close));
  // Bấm ra ngoài khung (vào backdrop) để đóng.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  dialog.querySelectorAll<HTMLButtonElement>("[data-font]").forEach((button) => {
    button.addEventListener("click", () => {
      const delta = button.dataset.font === "inc" ? FONT_SIZE.step : -FONT_SIZE.step;
      const size = Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, currentFontSize() + delta));
      update({ ...settings, fontSize: size });
    });
  });
  dialog.querySelectorAll<HTMLButtonElement>("[data-line]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = currentLineHeight();
      const steps = [...LINE_HEIGHTS];
      const next =
        button.dataset.line === "inc"
          ? (steps.find((value) => value > current + 0.001) ?? current)
          : ([...steps].reverse().find((value) => value < current - 0.001) ?? current);
      update({ ...settings, lineHeight: next });
    });
  });
  dialog.querySelectorAll<HTMLInputElement>('input[name="reader-theme"]').forEach((input) => {
    input.addEventListener("change", () => {
      const choice = parseTheme(input.value);
      applyTheme(choice);
      writeTheme(choice);
    });
  });
  dialog.querySelector<HTMLButtonElement>("[data-reset-settings]")?.addEventListener("click", () => {
    applyTheme("system");
    writeTheme("system");
    update({ fontSize: null, lineHeight: null });
  });
}

function initKeyboard(article: HTMLElement): void {
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable], dialog[open]")) return;
    const href = event.key === "ArrowLeft" ? article.dataset.prev : article.dataset.next;
    if (href) window.location.assign(href);
  });
}

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

function initPrefetch(article: HTMLElement): void {
  const next = article.dataset.next;
  if (!next) return;
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  // Không xác định được chất lượng mạng (Safari/Firefox) thì không prefetch.
  if (!connection || connection.saveData || !connection.effectiveType || connection.effectiveType !== "4g") return;
  const run = () => {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = next;
    document.head.append(link);
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  if (idle) idle(run, { timeout: 4000 });
  else window.setTimeout(run, 2500);
}

const article = document.querySelector<HTMLElement>("[data-reader]");
if (article) {
  initSettings(article);
  initProgress(article);
  initKeyboard(article);
  initPrefetch(article);
}
