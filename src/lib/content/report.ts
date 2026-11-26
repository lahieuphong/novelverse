/**
 * Báo cáo kiểm tra nội dung dạng văn bản – dùng chung cho lệnh `npm run content:check`
 * và integration chạy trong `astro build`.
 */
import type { Catalog, ContentIssue, IssueLevel } from "./loader.ts";

const LEVEL_LABEL: Record<IssueLevel, string> = { error: "LỖI", warning: "CẢNH BÁO", info: "THÔNG TIN" };

export interface CatalogSummary {
  novels: Array<{
    slug: string;
    title: string;
    files: number;
    readable: number;
    lastNumber: number;
  }>;
  errors: number;
  warnings: number;
  infos: number;
}

export function summarize(catalog: Catalog): CatalogSummary {
  const count = (level: IssueLevel) => catalog.issues.filter((issue) => issue.level === level).length;
  return {
    novels: catalog.novels.map((novel) => ({
      slug: novel.meta.slug,
      title: novel.meta.title,
      files: novel.chapters.length,
      readable: novel.chapters.filter((chapter) => chapter.status === "ok").length,
      lastNumber: novel.chapters[novel.chapters.length - 1]?.number ?? 0,
    })),
    errors: count("error"),
    warnings: count("warning"),
    infos: count("info"),
  };
}

function formatIssue(issue: ContentIssue): string {
  const where = [issue.novel, issue.file].filter(Boolean).join(" · ");
  return `  [${LEVEL_LABEL[issue.level]}] ${issue.code}${where ? ` (${where})` : ""}: ${issue.message}`;
}

/** Gộp các issue thông tin trùng mã để báo cáo không quá dài. */
function compactInfos(issues: readonly ContentIssue[], limit: number): string[] {
  const groups = new Map<string, ContentIssue[]>();
  for (const issue of issues) {
    const key = `${issue.novel ?? ""}|${issue.code}`;
    const list = groups.get(key);
    if (list) list.push(issue);
    else groups.set(key, [issue]);
  }
  const lines: string[] = [];
  for (const list of groups.values()) {
    list.slice(0, limit).forEach((issue) => lines.push(formatIssue(issue)));
    if (list.length > limit) lines.push(`  … và ${list.length - limit} mục ${list[0]?.code} khác`);
  }
  return lines;
}

export function formatReport(catalog: Catalog, options: { verbose?: boolean } = {}): string {
  const summary = summarize(catalog);
  const lines: string[] = [];
  lines.push(`Truyện: ${summary.novels.length}`);
  for (const novel of summary.novels) {
    lines.push(
      `  • ${novel.title} (${novel.slug}): ${novel.files} file chương, ${novel.readable} chương đọc được, chương cuối ${novel.lastNumber}`,
    );
  }
  const errors = catalog.issues.filter((issue) => issue.level === "error");
  const warnings = catalog.issues.filter((issue) => issue.level === "warning");
  const infos = catalog.issues.filter((issue) => issue.level === "info");
  if (errors.length) lines.push("", "Lỗi (dừng build):", ...errors.map(formatIssue));
  if (warnings.length) lines.push("", "Cảnh báo (vẫn build, trang sẽ đánh dấu chương thiếu):", ...compactInfos(warnings, options.verbose ? Infinity : 10));
  if (infos.length) lines.push("", "Thông tin:", ...compactInfos(infos, options.verbose ? Infinity : 3));
  lines.push("", `Tổng: ${summary.errors} lỗi, ${summary.warnings} cảnh báo, ${summary.infos} thông tin`);
  return lines.join("\n");
}
