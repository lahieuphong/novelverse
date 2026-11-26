/**
 * Bản build thử có thêm truyện fixture (tests/fixtures/novels) để kiểm tra luồng nhiều truyện.
 * Kết quả ở dist-fixture/, không ảnh hưởng dist/ và danh mục chính.
 *
 *   npm run build:fixture
 *   npm run preview:fixture
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const astro = path.join(root, "node_modules", "astro", "bin", "astro.mjs");
const command = process.argv[2] === "preview" ? "preview" : "build";

const result = spawnSync(process.execPath, [astro, command, "--outDir", "dist-fixture", ...process.argv.slice(3)], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NOVELVERSE_CONTENT_DIRS: "content/novels,tests/fixtures/novels" },
});
process.exitCode = result.status ?? 1;
