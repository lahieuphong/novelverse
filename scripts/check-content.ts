/**
 * Kiểm tra cây thư mục truyện trước khi build.
 *
 *   npm run content:check                 # báo cáo, thoát mã 1 nếu có lỗi
 *   npm run content:check -- --verbose    # liệt kê đầy đủ
 *   npm run content:check -- --json       # xuất JSON (cho CI)
 *   npm run content:check -- --write-schema   # cập nhật content/novel.schema.json
 *
 * Thư mục truyện: content/novels (mặc định) hoặc NOVELVERSE_CONTENT_DIRS="a,b".
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { contentDirsFromEnv, hasErrors, loadCatalog } from "../src/lib/content/loader.ts";
import { formatReport, summarize } from "../src/lib/content/report.ts";
import { novelJsonSchema } from "../src/lib/content/schema.ts";

const args = new Set(process.argv.slice(2));
const projectRoot = path.resolve(import.meta.dirname, "..");

if (args.has("--write-schema")) {
  const target = path.join(projectRoot, "content", "novel.schema.json");
  writeFileSync(target, `${JSON.stringify(novelJsonSchema(), null, 2)}\n`, "utf8");
  console.log(`Đã ghi ${path.relative(projectRoot, target)}`);
}

const started = performance.now();
const catalog = loadCatalog({ projectRoot, contentDirs: contentDirsFromEnv() });
const elapsed = Math.round(performance.now() - started);

if (args.has("--json")) {
  console.log(JSON.stringify({ summary: summarize(catalog), issues: catalog.issues, elapsedMs: elapsed }, null, 2));
} else {
  console.log(formatReport(catalog, { verbose: args.has("--verbose") }));
  console.log(`Thời gian quét: ${elapsed} ms`);
}

process.exitCode = hasErrors(catalog.issues) ? 1 : 0;
