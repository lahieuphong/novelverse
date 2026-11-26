/**
 * Hộp cài đặt đọc được dựng bằng script khi trang tải: chỉ hoạt động khi có JS, nên không cần
 * lặp lại markup trong HTML của hơn 2.000 trang chương. Chuỗi markup cố định, không chứa dữ liệu người dùng.
 */
import { iconSvg } from "@/lib/icons";

const THEMES = [
  { value: "system", label: "Theo máy", swatch: "linear-gradient(135deg,#f8f5ee 50%,#141617 50%)" },
  { value: "light", label: "Sáng", swatch: "#f8f5ee" },
  { value: "sepia", label: "Sepia", swatch: "#f3e8d0" },
  { value: "dark", label: "Tối", swatch: "#141617" },
];

const ROUND_BUTTON =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border bg-background shadow-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40";

function stepper(id: string, label: string, key: "font" | "line", dec: string, inc: string): string {
  return `<div class="flex items-center justify-between gap-4">
  <span id="${id}" class="font-medium">${label}</span>
  <div class="flex items-center gap-3" role="group" aria-labelledby="${id}">
    <button type="button" class="${ROUND_BUTTON}" data-${key}="dec" aria-label="${dec}">${iconSvg("minus")}</button>
    <output class="w-16 text-center tabular-nums" data-${key}-value aria-live="polite">–</output>
    <button type="button" class="${ROUND_BUTTON}" data-${key}="inc" aria-label="${inc}">${iconSvg("plus")}</button>
  </div>
</div>`;
}

const MARKUP = `<div class="space-y-6 px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
  <div class="flex items-center justify-between gap-4">
    <h2 id="reader-settings-title" class="text-lg font-bold">Cài đặt đọc</h2>
    <button type="button" class="inline-flex size-11 items-center justify-center rounded-full outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50" data-close-settings aria-label="Đóng cài đặt">${iconSvg("x")}</button>
  </div>
  ${stepper("font-size-label", "Cỡ chữ", "font", "Giảm cỡ chữ", "Tăng cỡ chữ")}
  ${stepper("line-height-label", "Giãn dòng", "line", "Giảm giãn dòng", "Tăng giãn dòng")}
  <fieldset>
    <legend class="mb-3 font-medium">Màu nền</legend>
    <div class="grid grid-cols-4 gap-2">
      ${THEMES.map(
        (theme) => `<label class="flex min-h-11 cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-2 text-center text-xs font-medium has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring">
        <input type="radio" name="reader-theme" value="${theme.value}" class="sr-only">
        <span class="size-8 rounded-full border border-black/15" style="background:${theme.swatch}" aria-hidden="true"></span>${theme.label}
      </label>`,
      ).join("")}
    </div>
  </fieldset>
  <button type="button" class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50" data-reset-settings>${iconSvg("rotate-ccw", "size-4")}Đặt lại mặc định</button>
</div>`;

export function mountSettingsDialog(): HTMLDialogElement {
  const existing = document.getElementById("reader-settings");
  if (existing instanceof HTMLDialogElement) return existing;
  const dialog = document.createElement("dialog");
  dialog.id = "reader-settings";
  dialog.className =
    "reader-settings m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border bg-popover p-0 text-popover-foreground shadow-xl sm:m-auto sm:max-w-md sm:rounded-2xl";
  dialog.setAttribute("aria-labelledby", "reader-settings-title");
  dialog.innerHTML = MARKUP;
  document.body.append(dialog);
  return dialog;
}
