/**
 * Đọc cây thư mục truyện ở thời điểm build.
 *
 * - Danh mục + mục lục: loadCatalog() quét mỗi truyện một lần, giữ metadata gọn (số, tên, trạng thái).
 * - Trang chương: readChapter() chỉ đọc đúng file của chương đang render.
 *
 * Chỉ import tương đối có đuôi .ts để chạy được bằng Node (scripts/check-content.ts).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { COVER_EXTENSIONS, formatZodIssues, novelMetaSchema, type NovelMeta } from "./schema.ts";
import {
  classifyBody,
  decodeUtf8,
  formatRanges,
  normalizeNewlines,
  parseChapterNumberFromFileName,
  parseChapterText,
  parseTitleLine,
  PLACEHOLDER_MAX_LENGTH,
  type BodyStatus,
  type ParsedChapterText,
} from "./text.ts";

export const DEFAULT_CONTENT_DIRS = ["content/novels"] as const;
/** Thư mục có glob ảnh bìa trong covers.ts (glob của Vite phải là chuỗi cố định). */
export const COVER_ROOTS = ["content/novels", "tests/fixtures/novels"] as const;
export const NOVEL_FILE = "novel.json";

export type IssueLevel = "error" | "warning" | "info";
export type IssueCode =
  | "content-dir-missing"
  | "novel-json-missing"
  | "novel-json-invalid"
  | "novel-meta-invalid"
  | "slug-folder-mismatch"
  | "duplicate-slug"
  | "chapters-dir-missing"
  | "chapters-dir-outside-project"
  | "cover-missing"
  | "cover-unsupported"
  | "file-unreadable"
  | "file-unnumbered"
  | "file-ignored"
  | "duplicate-chapter-number"
  | "chapter-number-outlier"
  | "title-number-mismatch"
  | "title-missing"
  | "chapters-missing"
  | "chapters-placeholder"
  | "chapters-empty"
  | "no-readable-chapters";

export interface ContentIssue {
  level: IssueLevel;
  code: IssueCode;
  message: string;
  novel?: string;
  /** Đường dẫn tương đối với gốc dự án, chỉ dùng trong báo cáo kiểm tra (không đưa ra HTML). */
  file?: string;
  chapters?: number[];
}

export type ChapterStatus = BodyStatus;

export interface ChapterRecord {
  number: number;
  /** Tên chương (không gồm "Chương N:"), null nếu file không có tên. */
  name: string | null;
  status: ChapterStatus;
  /** Đường dẫn tuyệt đối tới file – chỉ dùng ở build, không render ra trang. */
  file: string;
}

export interface NovelRecord {
  meta: NovelMeta;
  /** Thư mục chứa novel.json (tuyệt đối). */
  dir: string;
  chaptersDir: string;
  /** File ảnh bìa (tuyệt đối) nếu có và tồn tại. */
  coverFile: string | null;
  /** Các chương có file, sắp theo số, không trùng số. */
  chapters: ChapterRecord[];
}

export interface Catalog {
  projectRoot: string;
  novels: NovelRecord[];
  issues: ContentIssue[];
}

export interface LoadOptions {
  projectRoot: string;
  /** Các thư mục gốc chứa truyện (mỗi thư mục con là một truyện), tương đối với projectRoot. */
  contentDirs?: readonly string[];
}

/** Hai chương liền nhau cách nhau hơn mức này thì coi chương sau là số bất thường. */
export const MAX_CHAPTER_GAP = 1000;
export const MAX_CHAPTER_NUMBER = 100_000;

const IGNORED_ENTRIES =/^(?:\.|_|thumbs\.db$|desktop\.ini$)/i;

function relative(projectRoot: string, file: string): string {
  return path.relative(projectRoot, file).split(path.sep).join("/");
}

function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** Đọc thư mục truyện mặc định hoặc theo biến môi trường NOVELVERSE_CONTENT_DIRS (phân tách bằng dấu phẩy). */
export function contentDirsFromEnv(env: Record<string, string | undefined> = process.env): string[] {
  const raw = env.NOVELVERSE_CONTENT_DIRS?.trim();
  if (!raw) return [...DEFAULT_CONTENT_DIRS];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function readJson(file: string): unknown {
  return JSON.parse(decodeUtf8(readFileSync(file)));
}

interface ChapterScan {
  chapters: ChapterRecord[];
  issues: ContentIssue[];
}

function scanChapters(slug: string, chaptersDir: string, projectRoot: string): ChapterScan {
  const issues: ContentIssue[] = [];
  const byNumber = new Map<number, ChapterRecord[]>();

  const entries = readdirSync(chaptersDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name, "en", { numeric: true }),
  );

  for (const entry of entries) {
    if (IGNORED_ENTRIES.test(entry.name)) continue;
    const file = path.join(chaptersDir, entry.name);
    const rel = relative(projectRoot, file);
    if (!entry.isFile()) {
      issues.push({ level: "info", code: "file-ignored", novel: slug, file: rel, message: "Bỏ qua thư mục con trong thư mục chương" });
      continue;
    }
    if (!/\.txt$/i.test(entry.name)) {
      issues.push({ level: "info", code: "file-ignored", novel: slug, file: rel, message: "Bỏ qua file không phải .txt" });
      continue;
    }
    const number = parseChapterNumberFromFileName(entry.name);
    if (number === null) {
      issues.push({
        level: "warning",
        code: "file-unnumbered",
        novel: slug,
        file: rel,
        message: "Tên file không có số chương (ví dụ hợp lệ: 0001.txt, chuong_0001.txt) – đã bỏ qua",
      });
      continue;
    }

    let text: string;
    try {
      text = normalizeNewlines(decodeUtf8(readFileSync(file)));
    } catch (error) {
      issues.push({
        level: "error",
        code: "file-unreadable",
        novel: slug,
        file: rel,
        chapters: [number],
        message: `Không đọc được file dưới dạng UTF-8 (${error instanceof Error ? error.message : String(error)})`,
      });
      continue;
    }

    // Chỉ lấy dòng tiêu đề + phân loại thân chương; không giữ nội dung trong bộ nhớ.
    const firstBreak = text.search(/\S/);
    const firstLineEnd = firstBreak < 0 ? -1 : text.indexOf("\n", firstBreak);
    const firstLine = firstBreak < 0 ? "" : text.slice(firstBreak, firstLineEnd < 0 ? undefined : firstLineEnd);
    const title = parseTitleLine(firstLine);
    const body = title ? (firstLineEnd < 0 ? "" : text.slice(firstLineEnd + 1)) : text;
    const trimmedLength = body.trim().length;
    let status: ChapterStatus;
    if (trimmedLength === 0) status = "empty";
    else if (trimmedLength <= PLACEHOLDER_MAX_LENGTH * 2) {
      // Thân ngắn: xét đúng các đoạn sẽ hiển thị (sau khi bỏ tiêu đề lặp…), để trang không bao giờ trống.
      const { paragraphs } = parseChapterText(text);
      status = paragraphs.length === 0 ? "empty" : classifyBody(paragraphs.join("\n"));
    } else status = "ok";

    if (!title) {
      issues.push({
        level: "info",
        code: "title-missing",
        novel: slug,
        file: rel,
        chapters: [number],
        message: `Dòng đầu không có dạng "Chương ${number}: Tên chương" – sẽ hiển thị "Chương ${number}"`,
      });
    } else if (title.number !== number) {
      issues.push({
        level: "warning",
        code: "title-number-mismatch",
        novel: slug,
        file: rel,
        chapters: [number],
        message: `Tên file là chương ${number} nhưng dòng tiêu đề ghi chương ${title.number} – URL dùng số theo tên file`,
      });
    }

    const record: ChapterRecord = { number, name: title?.name ?? null, status, file };
    const list = byNumber.get(number);
    if (list) list.push(record);
    else byNumber.set(number, [record]);
  }

  // Số chương bất thường (file lạc như "backup_20241126.txt") sẽ sinh hàng trăm nghìn trang mục lục:
  // báo lỗi và loại khỏi danh mục. Xét khoảng cách giữa các chương liền nhau và một trần tuyệt đối.
  const sorted = [...byNumber.entries()].sort((a, b) => a[0] - b[0]);
  let previous: number | null = null;
  let cut = sorted.length;
  for (let i = 0; i < sorted.length; i++) {
    const number = sorted[i]?.[0] ?? 0;
    if (number > MAX_CHAPTER_NUMBER || (previous !== null && number - previous > MAX_CHAPTER_GAP)) {
      cut = i;
      break;
    }
    previous = number;
  }
  for (const [number, records] of sorted.slice(cut)) {
    issues.push({
      level: "error",
      code: "chapter-number-outlier",
      novel: slug,
      chapters: [number],
      file: relative(projectRoot, records[0]?.file ?? ""),
      message: `Số chương ${number} cách chương trước quá xa (> ${MAX_CHAPTER_GAP}) hoặc vượt ${MAX_CHAPTER_NUMBER} – có thể là file lạc; đổi tên hoặc xóa file`,
    });
  }

  const chapters: ChapterRecord[] = [];
  for (const [number, records] of sorted.slice(0, cut)) {
    if (records.length > 1) {
      issues.push({
        level: "error",
        code: "duplicate-chapter-number",
        novel: slug,
        chapters: [number],
        message: `Nhiều file cùng là chương ${number}: ${records.map((r) => relative(projectRoot, r.file)).join(", ")}`,
      });
    }
    const first = records[0];
    if (first) chapters.push(first);
  }

  // Khoảng thiếu: từ chương 1 (hoặc số nhỏ nhất nếu nhỏ hơn 1) tới chương lớn nhất.
  const last = chapters[chapters.length - 1];
  if (last) {
    const present = new Set(chapters.map((c) => c.number));
    const start = Math.min(1, chapters[0]?.number ?? 1);
    const missing: number[] = [];
    for (let n = start; n <= last.number; n++) if (!present.has(n)) missing.push(n);
    if (missing.length) {
      issues.push({
        level: "warning",
        code: "chapters-missing",
        novel: slug,
        chapters: missing,
        message: `Thiếu file cho ${missing.length} chương: ${formatRanges(missing)}`,
      });
    }
  }

  const placeholders = chapters.filter((c) => c.status === "placeholder").map((c) => c.number);
  if (placeholders.length) {
    issues.push({
      level: "warning",
      code: "chapters-placeholder",
      novel: slug,
      chapters: placeholders,
      message: `${placeholders.length} chương chỉ có câu báo chưa cập nhật: ${formatRanges(placeholders)}`,
    });
  }
  const empties = chapters.filter((c) => c.status === "empty").map((c) => c.number);
  if (empties.length) {
    issues.push({
      level: "warning",
      code: "chapters-empty",
      novel: slug,
      chapters: empties,
      message: `${empties.length} chương có file nhưng không có nội dung: ${formatRanges(empties)}`,
    });
  }
  if (!chapters.some((c) => c.status === "ok")) {
    issues.push({ level: "warning", code: "no-readable-chapters", novel: slug, message: "Truyện chưa có chương nào đọc được" });
  }

  return { chapters, issues };
}

function loadNovel(novelDir: string, projectRoot: string): { novel: NovelRecord | null; issues: ContentIssue[] } {
  const folder = path.basename(novelDir);
  const novelFile = path.join(novelDir, NOVEL_FILE);
  const relNovelFile = relative(projectRoot, novelFile);

  if (!existsSync(novelFile)) {
    return {
      novel: null,
      issues: [
        { level: "warning", code: "novel-json-missing", novel: folder, file: relative(projectRoot, novelDir), message: `Thư mục không có ${NOVEL_FILE} – đã bỏ qua` },
      ],
    };
  }

  let raw: unknown;
  try {
    raw = readJson(novelFile);
  } catch (error) {
    return {
      novel: null,
      issues: [
        {
          level: "error",
          code: "novel-json-invalid",
          novel: folder,
          file: relNovelFile,
          message: `Không đọc được JSON: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  const parsed = novelMetaSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      novel: null,
      issues: [
        {
          level: "error",
          code: "novel-meta-invalid",
          novel: folder,
          file: relNovelFile,
          message: `Metadata không hợp lệ – ${formatZodIssues(parsed.error).join("; ")}`,
        },
      ],
    };
  }

  const meta = parsed.data;
  const issues: ContentIssue[] = [];
  if (meta.slug !== folder) {
    issues.push({
      level: "warning",
      code: "slug-folder-mismatch",
      novel: meta.slug,
      file: relNovelFile,
      message: `slug "${meta.slug}" khác tên thư mục "${folder}" – URL dùng slug`,
    });
  }

  const chaptersDir = path.resolve(novelDir, meta.chaptersDir);
  if (!isInside(projectRoot, chaptersDir)) {
    issues.push({
      level: "error",
      code: "chapters-dir-outside-project",
      novel: meta.slug,
      file: relNovelFile,
      message: `chaptersDir "${meta.chaptersDir}" trỏ ra ngoài thư mục dự án`,
    });
    return { novel: null, issues };
  }
  if (!existsSync(chaptersDir) || !statSync(chaptersDir).isDirectory()) {
    issues.push({
      level: "error",
      code: "chapters-dir-missing",
      novel: meta.slug,
      file: relNovelFile,
      message: `Không tìm thấy thư mục chương "${meta.chaptersDir}"`,
    });
    return { novel: null, issues };
  }

  let coverFile: string | null = null;
  if (meta.cover) {
    const candidate = path.resolve(novelDir, meta.cover);
    const ext = path.extname(candidate).toLowerCase();
    // Dò tên file thật trên đĩa (không phân biệt hoa/thường) để Windows và Linux cho cùng kết quả,
    // và để khóa tra ảnh trong covers.ts khớp đúng tên file.
    const onDisk =
      path.dirname(candidate) === novelDir
        ? readdirSync(novelDir).find((name) => name.toLowerCase() === path.basename(candidate).toLowerCase())
        : undefined;
    const coverRoot = relative(projectRoot, path.dirname(novelDir));
    if (!(COVER_EXTENSIONS as readonly string[]).includes(ext)) {
      issues.push({ level: "warning", code: "cover-unsupported", novel: meta.slug, file: relNovelFile, message: `Ảnh bìa phải là ${COVER_EXTENSIONS.join(", ")} – dùng bìa chữ` });
    } else if (!onDisk) {
      issues.push({
        level: "warning",
        code: "cover-missing",
        novel: meta.slug,
        file: relNovelFile,
        message: `Không tìm thấy ảnh bìa "${meta.cover}" (đặt file ảnh ngay trong thư mục truyện, cạnh novel.json) – dùng bìa chữ`,
      });
    } else if (!(COVER_ROOTS as readonly string[]).includes(coverRoot)) {
      issues.push({
        level: "warning",
        code: "cover-unsupported",
        novel: meta.slug,
        file: relNovelFile,
        message: `Ảnh bìa chỉ được xử lý cho truyện nằm trong ${COVER_ROOTS.join(" hoặc ")} – dùng bìa chữ`,
      });
    } else {
      coverFile = path.join(novelDir, onDisk);
    }
  }

  const scan = scanChapters(meta.slug, chaptersDir, projectRoot);
  issues.push(...scan.issues);
  return { novel: { meta, dir: novelDir, chaptersDir, coverFile, chapters: scan.chapters }, issues };
}

/** Quét toàn bộ thư mục truyện. Không ném lỗi: mọi vấn đề được trả về trong issues. */
export function loadCatalog(options: LoadOptions): Catalog {
  const projectRoot = path.resolve(options.projectRoot);
  const contentDirs = options.contentDirs ?? DEFAULT_CONTENT_DIRS;
  const issues: ContentIssue[] = [];
  const novels: NovelRecord[] = [];

  for (const dir of contentDirs) {
    const root = path.resolve(projectRoot, dir);
    if (!existsSync(root) || !statSync(root).isDirectory()) {
      issues.push({ level: "error", code: "content-dir-missing", file: relative(projectRoot, root), message: "Không tìm thấy thư mục truyện" });
      continue;
    }
    const folders = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !IGNORED_ENTRIES.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    for (const folder of folders) {
      const result = loadNovel(path.join(root, folder), projectRoot);
      issues.push(...result.issues);
      if (result.novel) novels.push(result.novel);
    }
  }

  const bySlug = new Map<string, NovelRecord[]>();
  for (const novel of novels) {
    const list = bySlug.get(novel.meta.slug);
    if (list) list.push(novel);
    else bySlug.set(novel.meta.slug, [novel]);
  }
  for (const [slug, list] of bySlug) {
    if (list.length > 1) {
      issues.push({
        level: "error",
        code: "duplicate-slug",
        novel: slug,
        message: `Slug "${slug}" bị dùng bởi nhiều truyện: ${list.map((n) => relative(projectRoot, n.dir)).join(", ")}`,
      });
    }
  }

  return { projectRoot, novels, issues };
}

/** Đọc và tách nội dung một chương (chỉ file của chương đó). */
export function readChapter(chapter: Pick<ChapterRecord, "file">): ParsedChapterText {
  return parseChapterText(decodeUtf8(readFileSync(chapter.file)));
}

export function hasErrors(issues: readonly ContentIssue[]): boolean {
  return issues.some((issue) => issue.level === "error");
}
