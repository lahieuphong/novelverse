import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import contentCheck from "./src/integrations/content-check.ts";
import { contentDirsFromEnv } from "./src/lib/content/loader.ts";

/**
 * SITE_URL: domain xuất bản (ví dụ https://novelverse.example). Khi có, trang sinh canonical
 * tuyệt đối và sitemap.xml. BASE_PATH: tiền tố đường dẫn nếu deploy dưới thư mục con.
 */
const site = process.env.SITE_URL?.trim() || undefined;
const base = process.env.BASE_PATH?.trim() || undefined;

// Ảnh bìa của truyện fixture chỉ được đóng gói khi build thử có thư mục tests/fixtures.
const fixtureCovers = contentDirsFromEnv().some((dir) => dir.replace(/\\/g, "/").replace(/^\.\//, "").startsWith("tests/fixtures"));

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "ignore",
  build: {
    format: "directory",
    inlineStylesheets: "auto",
  },
  // Chỉ prefetch có chủ đích (một chương kế tiếp) trong script trang đọc.
  prefetch: false,
  devToolbar: { enabled: false },
  integrations: [contentCheck(), react()],
  vite: {
    plugins: [tailwindcss()],
    define: {
      __NOVELVERSE_FIXTURE_COVERS__: JSON.stringify(fixtureCovers),
    },
  },
});
