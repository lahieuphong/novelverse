/**
 * Xử lý văn bản chương: thuần hàm, không đọc file, dùng chung cho build, kiểm tra nội dung và test.
 */

const BOM = "﻿";
const utf8 = new TextDecoder("utf-8", { fatal: true });

/** Giải mã UTF-8 (ném lỗi nếu byte không hợp lệ) và bỏ BOM đầu file. */
export function decodeUtf8(bytes: Uint8Array): string {
  const text = utf8.decode(bytes);
  return text.startsWith(BOM) ? text.slice(1) : text;
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** Gộp khoảng trắng (tab, nbsp, nhiều dấu cách) thành một dấu cách. */
export function collapseWhitespace(text: string): string {
  return text.replace(/[\s ​]+/gu, " ").trim();
}

/** Bỏ dấu tiếng Việt và về chữ thường: "Tiên Nghịch" -> "tien nghich". */
export function foldVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/**
 * Dòng tiêu đề chương: "Chương 12: Tên chương", "Chuong 12 - ...", "Chapter 12. ...", "Hồi 3: ...".
 * Nhóm 1 là số chương, nhóm 2 là tên chương (có thể rỗng).
 */
const TITLE_LINE = /^(?:chương|chuong|chapter|chap|ch\.)\s*0*(\d+)\b\s*(?:[:.\-–—]+\s*)?(.*)$/iu;
/**
 * "Hồi" cũng là từ thường ("Hồi 5 tuổi, hắn…"), nên chỉ coi là tiêu đề khi sau số có dấu phân cách
 * hoặc hết dòng.
 */
const HOI_TITLE_LINE = /^(?:hồi|hoi)\s*0*(\d+)\s*(?:$|[:.\-–—]+\s*(.*)$)/iu;
/** Tên chương dài hơn mức này thì gần như chắc là câu văn, không phải tiêu đề. */
const MAX_TITLE_NAME_LENGTH = 150;

/** Ký tự kết câu: sau các ký tự này, xuống đoạn là có chủ ý. */
const SENTENCE_END = /[.!?…:;"'”’»)\]}~*>]$/u;
const STARTS_LOWERCASE = /^\p{Ll}/u;

export interface ParsedTitle {
  number: number;
  /** Tên chương sau phần "Chương N:", đã gộp khoảng trắng. null nếu chỉ có "Chương N". */
  name: string | null;
}

export function parseTitleLine(line: string): ParsedTitle | null {
  const text = collapseWhitespace(line);
  const match = TITLE_LINE.exec(text) ?? HOI_TITLE_LINE.exec(text);
  if (!match?.[1]) return null;
  const name = collapseWhitespace(match[2] ?? "");
  if (name.length > MAX_TITLE_NAME_LENGTH) return null;
  return { number: Number.parseInt(match[1], 10), name: name || null };
}

/** Số chương lấy từ tên file: nhóm chữ số cuối cùng. "chuong_0012.txt" -> 12, "12.txt" -> 12. */
export function parseChapterNumberFromFileName(fileName: string): number | null {
  if (!/\.txt$/i.test(fileName)) return null;
  const stem = fileName.slice(0, -4);
  const match = /(\d+)(?!.*\d)/.exec(stem);
  if (!match?.[1]) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(value) ? value : null;
}

export interface ParsedChapterText {
  /** Tiêu đề đọc được ở dòng đầu (nếu dòng đầu có dạng "Chương N..."). */
  title: ParsedTitle | null;
  /** Các đoạn văn. Một đoạn có thể chứa "\n" khi ngắt dòng có chủ ý bên trong đoạn. */
  paragraphs: string[];
}

const STARTS_UPPERCASE = /^\p{Lu}/u;

/** Cần ít nhất chừng này dòng gãy (chữ thường) để tin rằng chương bị ngắt dòng cứng theo độ rộng. */
const MIN_WRAP_EVIDENCE = 3;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Ước lượng độ rộng ngắt dòng cứng của chương: trung vị độ dài các dòng chắc chắn bị cắt giữa câu
 * (không có dấu kết câu và dòng sau bắt đầu bằng chữ thường). null nếu không đủ bằng chứng.
 */
export function estimateWrapWidth(lines: readonly string[]): number | null {
  const wrapped: number[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!SENTENCE_END.test(line) && STARTS_LOWERCASE.test(lines[i + 1] ?? "")) wrapped.push(line.length);
  }
  return wrapped.length >= MIN_WRAP_EVIDENCE ? median(wrapped) : null;
}

/**
 * Hai dòng/đoạn có phải một câu bị cắt đôi không:
 * - dòng trước không kết thúc bằng dấu câu, và
 * - dòng sau bắt đầu bằng chữ thường; hoặc bắt đầu bằng chữ hoa (thường là tên riêng) nhưng dòng trước
 *   dài đúng bằng độ rộng ngắt dòng cứng của chương.
 */
function shouldJoin(previousLine: string, next: string, wrapWidth: number | null): boolean {
  if (SENTENCE_END.test(previousLine)) return false;
  if (STARTS_LOWERCASE.test(next)) return true;
  if (wrapWidth === null || !STARTS_UPPERCASE.test(next)) return false;
  return Math.abs(previousLine.length - wrapWidth) <= Math.max(6, Math.round(wrapWidth * 0.15));
}

/**
 * Tách tiêu đề khỏi thân chương và dựng danh sách đoạn văn.
 *
 * - Hỗ trợ LF/CRLF, BOM (đã bỏ ở decodeUtf8).
 * - Đoạn văn phân tách bằng dòng trống. Dòng đơn bên trong một đoạn được giữ (ngắt dòng có ý nghĩa).
 * - Nối lại câu bị cắt đôi khi nguồn xuống dòng giữa câu (xem shouldJoin, estimateWrapWidth).
 * - Bỏ đoạn đầu nếu nó lặp lại đúng tiêu đề.
 */
export function parseChapterText(raw: string): ParsedChapterText {
  const text = normalizeNewlines(raw.startsWith(BOM) ? raw.slice(1) : raw);
  const lines = text.split("\n");

  let title: ParsedTitle | null = null;
  let bodyStart = 0;
  const firstIndex = lines.findIndex((line) => line.trim() !== "");
  if (firstIndex >= 0) {
    const parsed = parseTitleLine(lines[firstIndex] ?? "");
    if (parsed) {
      title = parsed;
      bodyStart = firstIndex + 1;
    }
  }

  const blocks = lines
    .slice(bodyStart)
    .join("\n")
    .split(/\n[ \t ]*\n/)
    .map((block) =>
      block
        .split("\n")
        .map(collapseWhitespace)
        .filter((line) => line !== ""),
    )
    .filter((block) => block.length > 0);

  const wrapWidth = estimateWrapWidth(blocks.flat());

  // Mỗi đoạn nhớ dòng gốc cuối cùng của nó để so độ dài với độ rộng ngắt dòng.
  const paragraphs: Array<{ text: string; lastLine: string }> = [];
  for (const blockLines of blocks) {
    // Nối các dòng bị gãy giữa câu bên trong một khối; giữ các dòng còn lại tách riêng.
    const merged: string[] = [];
    let lastLine = "";
    for (const line of blockLines) {
      const last = merged[merged.length - 1];
      if (last !== undefined && shouldJoin(lastLine, line, wrapWidth)) merged[merged.length - 1] = `${last} ${line}`;
      else merged.push(line);
      lastLine = line;
    }
    const text = merged.join("\n");

    const previous = paragraphs[paragraphs.length - 1];
    if (previous !== undefined && shouldJoin(previous.lastLine, blockLines[0] ?? "", wrapWidth)) {
      previous.text = `${previous.text} ${text}`;
      previous.lastLine = lastLine;
    } else {
      paragraphs.push({ text, lastLine });
    }
  }

  const texts = paragraphs.map((paragraph) => paragraph.text);

  // Một số nguồn lặp lại tiêu đề ở đoạn đầu.
  if (title && texts.length > 0) {
    const first = foldVietnamese(texts[0] ?? "");
    const again = parseTitleLine(texts[0] ?? "");
    const sameName = title.name !== null && first === foldVietnamese(title.name);
    if ((again && again.number === title.number) || sameName) texts.shift();
  }

  return { title, paragraphs: texts };
}

export type BodyStatus = "ok" | "empty" | "placeholder";

const PLACEHOLDER_PATTERNS = [
  /\b(?:chua|dang|se)\s+(?:duoc\s+)?(?:update|cap\s*nhat|bo\s*sung)\b/,
  /\bupdating\b/,
  /\bcoming\s+soon\b/,
  /\bto\s+be\s+updated\b/,
  /\bchua\s+co\s+noi\s+dung\b/,
  /\bnoi\s+dung\s+(?:dang|chua|se)\b/,
  /\bplaceholder\b/,
  /^tbd$/,
];

/** Thân chương dài hơn mức này thì coi là có nội dung, không kiểm tra placeholder. */
export const PLACEHOLDER_MAX_LENGTH = 200;

/**
 * Phân loại thân chương: rỗng, chỉ có câu báo "chưa cập nhật", hoặc có nội dung.
 * Dựa trên độ dài và mẫu câu, không dựa trên danh sách số chương.
 */
export function classifyBody(body: string): BodyStatus {
  const compact = collapseWhitespace(body);
  const folded = foldVietnamese(compact)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (folded === "") return "empty";
  if (compact.length <= PLACEHOLDER_MAX_LENGTH && PLACEHOLDER_PATTERNS.some((re) => re.test(folded))) {
    return "placeholder";
  }
  return "ok";
}

/** Đoạn trích ngắn cho thẻ meta description, cắt ở ranh giới từ. */
export function excerpt(paragraphs: readonly string[], maxLength = 155): string {
  let text = "";
  for (const paragraph of paragraphs) {
    text = text ? `${text} ${collapseWhitespace(paragraph)}` : collapseWhitespace(paragraph);
    if (text.length >= maxLength) break;
  }
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–-]+$/u, "")}…`;
}

/** [1106,1107,1108,1109,1200] -> [[1106,1109],[1200,1200]] */
export function compressRanges(numbers: readonly number[]): Array<[number, number]> {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];
  for (const value of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && value === last[1] + 1) last[1] = value;
    else ranges.push([value, value]);
  }
  return ranges;
}

/** "69, 439, 1106–1109" */
export function formatRanges(numbers: readonly number[]): string {
  return compressRanges(numbers)
    .map(([from, to]) => (from === to ? `${from}` : `${from}–${to}`))
    .join(", ");
}
