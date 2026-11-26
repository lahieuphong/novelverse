/**
 * Server tĩnh nhỏ để kiểm thử bản build giống host tĩnh thông thường:
 * /a/b/ -> a/b/index.html, /a/b -> 301 /a/b/, file không tồn tại -> 404.html (mã 404), nén gzip.
 *
 *   node scripts/serve-static.ts dist 4322
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { createGzip } from "node:zlib";

const root = path.resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? 4322);
const host = process.argv[4] ?? "127.0.0.1";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
};
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".json", ".xml", ".txt", ".svg"]);

type Resolved = { file: string; status: number } | { redirect: string } | { error: number };

function resolveFile(urlPath: string): Resolved {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return { error: 400 }; // mã hóa % sai
  }
  const target = path.resolve(root, `.${decoded}`);
  // So với root + dấu phân cách để "dist" không lọt sang thư mục anh em "dist-fixture".
  if (target !== root && !target.startsWith(root + path.sep)) return { file: path.join(root, "404.html"), status: 404 };
  if (existsSync(target) && statSync(target).isDirectory()) {
    if (!decoded.endsWith("/")) return { redirect: `${urlPath}/` };
    const index = path.join(target, "index.html");
    if (existsSync(index)) return { file: index, status: 200 };
  } else if (existsSync(target)) {
    return { file: target, status: 200 };
  }
  return { file: path.join(root, "404.html"), status: 404 };
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}`);
  const resolved = resolveFile(url.pathname);
  if ("error" in resolved) {
    response.writeHead(resolved.error, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad Request\n");
    return;
  }
  if ("redirect" in resolved) {
    response.writeHead(301, { Location: resolved.redirect + url.search });
    response.end();
    return;
  }
  const ext = path.extname(resolved.file).toLowerCase();
  const headers: Record<string, string> = {
    "Content-Type": TYPES[ext] ?? "application/octet-stream",
    "Cache-Control": resolved.file.includes(`${path.sep}_astro${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
  };
  const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(String(request.headers["accept-encoding"] ?? ""));
  if (gzip) headers["Content-Encoding"] = "gzip";
  response.writeHead(resolved.status, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = createReadStream(resolved.file);
  stream.on("error", () => response.destroy());
  (gzip ? stream.pipe(createGzip()) : stream).pipe(response);
}).listen(port, host, () => {
  console.log(`Phục vụ ${path.relative(process.cwd(), root) || "."} tại http://${host}:${port}/`);
});
