/**
 * Chạy kiểm tra nội dung ngay khi Astro khởi động build/dev.
 * - build: có lỗi (trùng slug/số chương, file không đọc được, metadata hỏng) thì dừng build.
 * - dev: chỉ in cảnh báo để vẫn xem trước được; thêm/sửa/xóa truyện hoặc chương thì quét lại
 *   danh mục và tải lại trang (không cần khởi động lại server).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { bumpContentVersion } from "../lib/content/catalog.ts";
import { contentDirsFromEnv, hasErrors, loadCatalog } from "../lib/content/loader.ts";
import { formatReport } from "../lib/content/report.ts";

export default function contentCheck(): AstroIntegration {
  let projectRoot = "";

  const check = (logger: { info: (m: string) => void; error: (m: string) => void }, command: string) => {
    const started = performance.now();
    const catalog = loadCatalog({ projectRoot, contentDirs: contentDirsFromEnv() });
    const report = formatReport(catalog);
    const elapsed = Math.round(performance.now() - started);
    if (hasErrors(catalog.issues)) {
      if (command === "build") throw new Error(`Kiểm tra nội dung thất bại – sửa các lỗi sau rồi build lại:\n${report}`);
      logger.error(`\n${report}`);
    } else {
      logger.info(`Kiểm tra nội dung xong trong ${elapsed} ms\n${report}`);
    }
    return catalog;
  };

  return {
    name: "novelverse:content-check",
    hooks: {
      "astro:config:setup": ({ command, config, logger }) => {
        if (command === "preview" || command === "sync") return;
        // Các trang đọc dữ liệu qua getCatalog() trong cùng tiến trình: dùng chung gốc dự án.
        projectRoot = process.env.NOVELVERSE_ROOT?.trim() || fileURLToPath(config.root);
        process.env.NOVELVERSE_ROOT = projectRoot;
        check(logger, command);
      },
      "astro:server:setup": ({ server, logger }) => {
        const catalog = loadCatalog({ projectRoot, contentDirs: contentDirsFromEnv() });
        const watched = [
          ...contentDirsFromEnv().map((dir) => path.resolve(projectRoot, dir)),
          ...catalog.novels.map((novel) => novel.chaptersDir),
        ];
        server.watcher.add(watched);
        let timer: ReturnType<typeof setTimeout> | undefined;
        server.watcher.on("all", (_event, file) => {
          const changed = path.resolve(file);
          if (!watched.some((dir) => changed === dir || changed.startsWith(dir + path.sep))) return;
          // Gom nhiều thay đổi liên tiếp (chép cả loạt chương) thành một lần quét lại.
          clearTimeout(timer);
          timer = setTimeout(() => {
            bumpContentVersion();
            check(logger, "dev");
            server.ws.send({ type: "full-reload" });
          }, 300);
        });
      },
    },
  };
}
