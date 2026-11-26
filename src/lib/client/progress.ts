/**
 * Tiến độ đọc theo slug truyện: chương đang đọc + đoạn văn đầu màn hình.
 * Dữ liệu cũ/sai định dạng bị bỏ qua thay vì làm hỏng trang.
 */
import { isRecord, readJson, writeJson } from "./storage.ts";

export const PROGRESS_KEY = "nv:progress:v1";
/** Liên kết "Đọc tiếp" thêm #doc-tiep để trang đọc khôi phục vị trí đoạn văn. */
export const RESUME_HASH = "doc-tiep";
const MAX_ENTRIES = 50;
/** Nhãn chương chỉ để hiển thị: cắt ngắn thay vì bỏ cả mục tiến độ. */
export const MAX_LABEL_LENGTH = 200;

export interface ProgressEntry {
  chapter: number;
  /** Nhãn chương để hiển thị ("Chương 12: …"). */
  label: string;
  /** Chỉ số đoạn văn ở đầu màn hình khi lưu (ổn định khi đổi cỡ chữ). */
  paragraph: number;
  updatedAt: number;
}

export type ProgressMap = Record<string, ProgressEntry>;

function isEntry(value: unknown): value is ProgressEntry {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.chapter) &&
    (value.chapter as number) >= 0 &&
    typeof value.label === "string" &&
    Number.isSafeInteger(value.paragraph) &&
    (value.paragraph as number) >= 0 &&
    typeof value.updatedAt === "number" &&
    Number.isFinite(value.updatedAt)
  );
}

/** Lọc dữ liệu đọc từ localStorage: chỉ giữ mục hợp lệ. */
export function parseProgress(value: unknown): ProgressMap {
  if (!isRecord(value)) return {};
  const result: ProgressMap = {};
  for (const [slug, entry] of Object.entries(value)) {
    if (/^[a-z0-9-]{1,120}$/.test(slug) && isEntry(entry)) {
      result[slug] = {
        chapter: entry.chapter,
        label: entry.label.slice(0, MAX_LABEL_LENGTH),
        paragraph: entry.paragraph,
        updatedAt: entry.updatedAt,
      };
    }
  }
  return result;
}

export function readAllProgress(): ProgressMap {
  return parseProgress(readJson(PROGRESS_KEY));
}

export function readProgress(slug: string): ProgressEntry | null {
  return readAllProgress()[slug] ?? null;
}

/** Ghi tiến độ, chỉ giữ MAX_ENTRIES truyện gần nhất. */
export function mergeProgress(map: ProgressMap, slug: string, entry: ProgressEntry): ProgressMap {
  const next: ProgressMap = { ...map, [slug]: entry };
  const slugs = Object.keys(next);
  if (slugs.length <= MAX_ENTRIES) return next;
  const keep = slugs.sort((a, b) => (next[b]?.updatedAt ?? 0) - (next[a]?.updatedAt ?? 0)).slice(0, MAX_ENTRIES);
  return Object.fromEntries(keep.map((key) => [key, next[key] as ProgressEntry]));
}

export function writeProgress(slug: string, entry: ProgressEntry): void {
  writeJson(PROGRESS_KEY, mergeProgress(readAllProgress(), slug, entry));
}
