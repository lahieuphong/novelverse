/**
 * Cài đặt đọc (cỡ chữ, giãn dòng) và theme. Các khóa + giá trị mặc định ở đây cũng được nhúng
 * vào script đầu trang (BaseLayout) để áp dụng trước khi vẽ, tránh nháy.
 */
import { isRecord, readJson, safeStorage, writeJson } from "./storage.ts";

export const THEME_KEY = "nv:theme";
export const SETTINGS_KEY = "nv:reader:v1";

export const THEMES = ["system", "light", "sepia", "dark"] as const;
export type ThemeChoice = (typeof THEMES)[number];
export type AppliedTheme = Exclude<ThemeChoice, "system">;

export const FONT_SIZE = { min: 15, max: 28, step: 1, default: 19 } as const;
export const LINE_HEIGHTS = [1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1] as const;
export const DEFAULT_LINE_HEIGHT = 1.75;
/** Giới hạn chấp nhận khi đọc dữ liệu đã lưu (rộng hơn các bước của nút bấm một chút). */
export const LINE_HEIGHT_RANGE = { min: 1.3, max: 2.2 } as const;

export interface ReaderSettings {
  /** px; null = mặc định theo màn hình. */
  fontSize: number | null;
  lineHeight: number | null;
}

export function parseSettings(value: unknown): ReaderSettings {
  const settings: ReaderSettings = { fontSize: null, lineHeight: null };
  if (!isRecord(value)) return settings;
  const { fontSize, lineHeight } = value;
  if (typeof fontSize === "number" && Number.isFinite(fontSize)) {
    settings.fontSize = Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, Math.round(fontSize)));
  }
  if (typeof lineHeight === "number" && Number.isFinite(lineHeight)) {
    settings.lineHeight = Math.min(LINE_HEIGHT_RANGE.max, Math.max(LINE_HEIGHT_RANGE.min, Math.round(lineHeight * 100) / 100));
  }
  return settings;
}

export function readSettings(): ReaderSettings {
  return parseSettings(readJson(SETTINGS_KEY));
}

export function writeSettings(settings: ReaderSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function applySettings(settings: ReaderSettings, root: HTMLElement = document.documentElement): void {
  if (settings.fontSize === null) root.style.removeProperty("--reader-font-size");
  else root.style.setProperty("--reader-font-size", `${settings.fontSize}px`);
  if (settings.lineHeight === null) root.style.removeProperty("--reader-line-height");
  else root.style.setProperty("--reader-line-height", String(settings.lineHeight));
}

export function parseTheme(value: unknown): ThemeChoice {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value) ? (value as ThemeChoice) : "system";
}

export function readTheme(): ThemeChoice {
  try {
    return parseTheme(safeStorage()?.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

export function resolveTheme(choice: ThemeChoice): AppliedTheme {
  if (choice !== "system") return choice;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const THEME_COLORS: Record<AppliedTheme, string> = { light: "#f8f5ee", sepia: "#f3e8d0", dark: "#141617" };

/** Màu thanh trình duyệt: theme cố định dùng một màu; "Theo máy" trả mỗi thẻ về màu theo media của nó. */
export function applyThemeColor(choice: ThemeChoice): void {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const isDarkMeta = (meta.media ?? "").includes("dark");
    meta.content = choice === "system" ? THEME_COLORS[isDarkMeta ? "dark" : "light"] : THEME_COLORS[choice];
  });
}

export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = resolveTheme(choice);
  root.dataset.themeChoice = choice;
  applyThemeColor(choice);
}

export function writeTheme(choice: ThemeChoice): void {
  try {
    const storage = safeStorage();
    if (!storage) return;
    if (choice === "system") storage.removeItem(THEME_KEY);
    else storage.setItem(THEME_KEY, choice);
  } catch {
    // bỏ qua
  }
}

/**
 * Script chạy trong <head> trước khi vẽ trang (đặt sau các thẻ meta theme-color). Viết tay ở dạng
 * chuỗi (is:inline) nên giữ ngắn; kẹp giá trị giống hệt parseSettings để trang và hộp cài đặt luôn khớp.
 */
export function headBootstrapScript(): string {
  const themeKey = JSON.stringify(THEME_KEY);
  const settingsKey = JSON.stringify(SETTINGS_KEY);
  const colors = JSON.stringify(THEME_COLORS);
  return [
    `(function(d,w){var r=d.documentElement,t=null,c=null;r.classList.remove("no-js");r.classList.add("js");`,
    `try{var s=w.localStorage;t=s.getItem(${themeKey});c=JSON.parse(s.getItem(${settingsKey})||"null")}catch(e){}`,
    `var m=w.matchMedia?w.matchMedia("(prefers-color-scheme: dark)"):null;`,
    `var ch=t==="light"||t==="dark"||t==="sepia"?t:"system";`,
    `r.dataset.themeChoice=ch;r.dataset.theme=ch==="system"?(m&&m.matches?"dark":"light"):ch;`,
    `if(ch!=="system"){var k=d.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<k.length;i++)k[i].content=${colors}[ch]}`,
    `if(m&&m.addEventListener)m.addEventListener("change",function(e){if(r.dataset.themeChoice==="system")r.dataset.theme=e.matches?"dark":"light"});`,
    `var n=function(v){return typeof v==="number"&&isFinite(v)};`,
    `if(c&&typeof c==="object"){var f=c.fontSize,l=c.lineHeight;`,
    `if(n(f))r.style.setProperty("--reader-font-size",Math.min(${FONT_SIZE.max},Math.max(${FONT_SIZE.min},Math.round(f)))+"px");`,
    `if(n(l))r.style.setProperty("--reader-line-height",String(Math.min(${LINE_HEIGHT_RANGE.max},Math.max(${LINE_HEIGHT_RANGE.min},Math.round(l*100)/100))))}`,
    `})(document,window);`,
  ].join("");
}
