import type { APIRoute, GetStaticPaths } from "astro";
import { getNovels, readableChapters, tocPageCount } from "@/lib/content/catalog";
import { chapterUrl, homeUrl, libraryUrl, novelUrl, tocUrl } from "@/lib/urls";

/**
 * sitemap.xml chỉ được sinh khi có SITE_URL (URL trong sitemap phải tuyệt đối).
 * Chỉ gồm URL có nội dung: không có chương thiếu/chưa cập nhật, không có 404.
 */
export const getStaticPaths = (() => (import.meta.env.SITE ? [{ params: { sitemap: "sitemap" } }] : [])) satisfies GetStaticPaths;

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const GET: APIRoute = ({ site }) => {
  if (!site) return new Response(null, { status: 404 });
  const urls: string[] = [homeUrl(), libraryUrl()];
  for (const novel of getNovels()) {
    urls.push(novelUrl(novel.meta.slug));
    for (let page = 1; page <= tocPageCount(novel); page++) urls.push(tocUrl(novel.meta.slug, page));
    for (const chapter of readableChapters(novel)) urls.push(chapterUrl(novel.meta.slug, chapter.number));
  }
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((path) => `<url><loc>${escapeXml(new URL(path, site).href)}</loc></url>`),
    "</urlset>",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
