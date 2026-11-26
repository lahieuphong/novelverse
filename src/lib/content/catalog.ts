/**
 * Lớp dữ liệu dùng cho các trang Astro: danh mục, mục lục phân trang, điều hướng chương.
 * Catalog được quét một lần cho mỗi tiến trình build và dùng lại cho mọi route.
 */
import { contentDirsFromEnv, loadCatalog, type Catalog, type ChapterRecord, type ChapterStatus, type NovelRecord } from "./loader.ts";
import { STATUS_LABELS } from "./schema.ts";

export const TOC_PAGE_SIZE = 50;

let cache: { key: string; catalog: Catalog } | null = null;

/**
 * Phiên bản nội dung dùng chung trong tiến trình (globalThis): integration ở dev tăng số này khi
 * file truyện thay đổi, để module catalog do Vite nạp (một bản riêng) biết phải quét lại.
 */
const VERSION_KEY = "__novelverseContentVersion";
type VersionHolder = { [VERSION_KEY]?: number };

export function bumpContentVersion(): void {
  const holder = globalThis as VersionHolder;
  holder[VERSION_KEY] = (holder[VERSION_KEY] ?? 0) + 1;
}

export function getCatalog(): Catalog {
  const projectRoot = process.env.NOVELVERSE_ROOT?.trim() || process.cwd();
  const contentDirs = contentDirsFromEnv();
  const key = JSON.stringify([projectRoot, contentDirs, (globalThis as VersionHolder)[VERSION_KEY] ?? 0]);
  if (cache?.key !== key) cache = { key, catalog: loadCatalog({ projectRoot, contentDirs }) };
  return cache.catalog;
}

/** Chỉ dùng trong test. */
export function resetCatalogCache(): void {
  cache = null;
}

const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

/** Truyện nổi bật trước, rồi theo ngày cập nhật mới nhất, rồi theo tên. */
export function sortNovels(novels: readonly NovelRecord[]): NovelRecord[] {
  return [...novels].sort((a, b) => {
    if (a.meta.featured !== b.meta.featured) return a.meta.featured ? -1 : 1;
    const dateA = a.meta.updatedAt ?? "";
    const dateB = b.meta.updatedAt ?? "";
    if (dateA !== dateB) return dateA < dateB ? 1 : -1;
    return collator.compare(a.meta.title, b.meta.title);
  });
}

export function getNovels(): NovelRecord[] {
  return sortNovels(getCatalog().novels);
}

export function getNovel(slug: string): NovelRecord | undefined {
  return getCatalog().novels.find((novel) => novel.meta.slug === slug);
}

export function statusLabel(novel: NovelRecord): string {
  return STATUS_LABELS[novel.meta.status];
}

// ---------------------------------------------------------------------------
// Chương và mục lục

export type TocStatus = ChapterStatus | "missing";

export interface TocEntry {
  number: number;
  name: string | null;
  status: TocStatus;
}

export function chapterLabel(number: number, name: string | null): string {
  return name ? `Chương ${number}: ${name}` : `Chương ${number}`;
}

export function readableChapters(novel: NovelRecord): ChapterRecord[] {
  return novel.chapters.filter((chapter) => chapter.status === "ok");
}

export interface NovelStats {
  /** Số chương lớn nhất có file. */
  lastNumber: number;
  firstNumber: number;
  readable: number;
  missing: number[];
  /** Có file nhưng rỗng hoặc chỉ là câu báo chưa cập nhật. */
  unavailable: number[];
  firstReadable: ChapterRecord | null;
  lastReadable: ChapterRecord | null;
}

const statsCache = new WeakMap<NovelRecord, NovelStats>();

export function novelStats(novel: NovelRecord): NovelStats {
  const cached = statsCache.get(novel);
  if (cached) return cached;
  const readable = readableChapters(novel);
  const lastNumber = novel.chapters[novel.chapters.length - 1]?.number ?? 0;
  const firstNumber = Math.min(1, novel.chapters[0]?.number ?? 1);
  const present = new Set(novel.chapters.map((chapter) => chapter.number));
  const missing: number[] = [];
  for (let n = firstNumber; n <= lastNumber; n++) if (!present.has(n)) missing.push(n);
  const stats: NovelStats = {
    lastNumber,
    firstNumber,
    readable: readable.length,
    missing,
    unavailable: novel.chapters.filter((c) => c.status !== "ok").map((c) => c.number),
    firstReadable: readable[0] ?? null,
    lastReadable: readable[readable.length - 1] ?? null,
  };
  statsCache.set(novel, stats);
  return stats;
}

/** Số trang mục lục; 0 khi truyện chưa có file chương nào (không sinh trang /muc-luc/). */
export function tocPageCount(novel: NovelRecord): number {
  const { firstNumber, lastNumber } = novelStats(novel);
  if (novel.chapters.length === 0 || lastNumber < firstNumber) return 0;
  return Math.max(1, Math.ceil((lastNumber - firstNumber + 1) / TOC_PAGE_SIZE));
}

/** Trang mục lục chứa chương `number` (bắt đầu từ 1). */
export function tocPageOf(novel: NovelRecord, number: number): number {
  const { firstNumber } = novelStats(novel);
  return Math.floor((number - firstNumber) / TOC_PAGE_SIZE) + 1;
}

/** Các mục của một trang mục lục, gồm cả vị trí chương thiếu file. */
export function tocEntries(novel: NovelRecord, page: number): TocEntry[] {
  const { firstNumber, lastNumber } = novelStats(novel);
  const byNumber = chaptersByNumber(novel);
  const start = firstNumber + (page - 1) * TOC_PAGE_SIZE;
  const end = Math.min(lastNumber, start + TOC_PAGE_SIZE - 1);
  const entries: TocEntry[] = [];
  for (let n = start; n <= end; n++) {
    const chapter = byNumber.get(n);
    entries.push(chapter ? { number: n, name: chapter.name, status: chapter.status } : { number: n, name: null, status: "missing" });
  }
  return entries;
}

export function tocPageRange(novel: NovelRecord, page: number): [number, number] {
  const { firstNumber, lastNumber } = novelStats(novel);
  const start = firstNumber + (page - 1) * TOC_PAGE_SIZE;
  return [start, Math.min(lastNumber, start + TOC_PAGE_SIZE - 1)];
}

export interface SkippedChapters {
  /** Số chương không có file. */
  missing: number[];
  /** Có file nhưng chưa có nội dung. */
  unavailable: number[];
}

export interface ChapterNeighbors {
  prev: ChapterRecord | null;
  next: ChapterRecord | null;
  /** Các chương bị nhảy qua khi đi tới chương trước/sau. */
  skippedBefore: SkippedChapters;
  skippedAfter: SkippedChapters;
}

const byNumberCache = new WeakMap<NovelRecord, Map<number, ChapterRecord>>();

function chaptersByNumber(novel: NovelRecord): Map<number, ChapterRecord> {
  let map = byNumberCache.get(novel);
  if (!map) {
    map = new Map(novel.chapters.map((chapter) => [chapter.number, chapter]));
    byNumberCache.set(novel, map);
  }
  return map;
}

function skippedBetween(novel: NovelRecord, from: number, to: number): SkippedChapters {
  const byNumber = chaptersByNumber(novel);
  const missing: number[] = [];
  const unavailable: number[] = [];
  for (let n = from + 1; n < to; n++) {
    const chapter = byNumber.get(n);
    if (!chapter) missing.push(n);
    else if (chapter.status !== "ok") unavailable.push(n);
  }
  return { missing, unavailable };
}

const neighborsCache = new WeakMap<NovelRecord, ChapterRecord[]>();

/** Chương trước/sau trỏ tới chương có nội dung gần nhất. */
export function chapterNeighbors(novel: NovelRecord, number: number): ChapterNeighbors {
  let readable = neighborsCache.get(novel);
  if (!readable) {
    readable = readableChapters(novel);
    neighborsCache.set(novel, readable);
  }
  // Tìm nhị phân vị trí của chương hiện tại trong danh sách chương đọc được.
  let low = 0;
  let high = readable.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((readable[mid]?.number ?? Infinity) < number) low = mid + 1;
    else high = mid;
  }
  const isCurrent = readable[low]?.number === number;
  const prev = readable[low - 1] ?? null;
  const next = readable[isCurrent ? low + 1 : low] ?? null;
  return {
    prev,
    next,
    skippedBefore: prev ? skippedBetween(novel, prev.number, number) : { missing: [], unavailable: [] },
    skippedAfter: next ? skippedBetween(novel, number, next.number) : { missing: [], unavailable: [] },
  };
}

/**
 * Câu giải thích ngắn khi chương trước/sau nhảy qua chương thiếu, ví dụ:
 * "Chương 69 chưa có trong dữ liệu nguồn nên chương sau là Chương 70."
 */
export function describeSkip(skipped: SkippedChapters, direction: "prev" | "next", target: number): string | null {
  const parts: string[] = [];
  if (skipped.missing.length) parts.push(`${rangeLabel(skipped.missing)} chưa có trong dữ liệu nguồn`);
  if (skipped.unavailable.length) parts.push(`${rangeLabel(skipped.unavailable)} chưa cập nhật nội dung`);
  if (!parts.length) return null;
  return `${parts.join("; ")} nên chương ${direction === "next" ? "sau" : "trước"} là Chương ${target}.`;
}

function rangeLabel(numbers: number[]): string {
  const sorted = [...numbers].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return "";
  if (sorted.length === 1) return `Chương ${first}`;
  if (last - first + 1 === sorted.length) return `Chương ${first}–${last}`;
  return `Các chương ${sorted.join(", ")}`;
}

export function findChapter(novel: NovelRecord, number: number): ChapterRecord | undefined {
  return chaptersByNumber(novel).get(number);
}
