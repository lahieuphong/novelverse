/** Tìm truyện theo tên / tên khác / tác giả, có dấu hoặc không dấu. Thuần hàm – dùng ở client và test. */
import { foldVietnamese } from "./content/text.ts";

/** Một mục trong /search-index.json – chỉ metadata, không có đường dẫn file hay nội dung chương. */
export interface SearchEntry {
  slug: string;
  title: string;
  altTitles: string[];
  author: string;
  genres: string[];
  status: string;
  chapters: number;
  url: string;
}

export interface SearchIndex {
  version: 1;
  novels: SearchEntry[];
}

export function normalizeForSearch(text: string): string {
  return foldVietnamese(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function haystack(entry: SearchEntry): { spaced: string; compact: string } {
  const spaced = normalizeForSearch([entry.title, ...entry.altTitles, entry.author].join(" "));
  return { spaced, compact: spaced.replace(/\s+/g, "") };
}

/** Mọi từ trong câu tìm phải xuất hiện (ví dụ "tien nghich", "nhi can", "tiennghich"). */
export function matchEntry(entry: SearchEntry, query: string): boolean {
  const tokens = normalizeForSearch(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  const { spaced, compact } = haystack(entry);
  return tokens.every((token) => spaced.includes(token) || compact.includes(token));
}

export function searchEntries(entries: readonly SearchEntry[], query: string): SearchEntry[] {
  return entries.filter((entry) => matchEntry(entry, query));
}

export function isSearchIndex(value: unknown): value is SearchIndex {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    Array.isArray((value as { novels?: unknown }).novels)
  );
}
