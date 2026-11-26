import type { APIRoute } from "astro";
import { getNovels, novelStats, statusLabel } from "@/lib/content/catalog";
import type { SearchIndex } from "@/lib/search";
import { novelUrl } from "@/lib/urls";

/** Chỉ mục tìm kiếm: chỉ metadata gọn của từng truyện (không đường dẫn file, không nội dung chương). */
export const GET: APIRoute = () => {
  const index: SearchIndex = {
    version: 1,
    novels: getNovels().map((novel) => ({
      slug: novel.meta.slug,
      title: novel.meta.title,
      altTitles: novel.meta.altTitles,
      author: novel.meta.author,
      genres: novel.meta.genres,
      status: statusLabel(novel),
      chapters: novelStats(novel).readable,
      url: novelUrl(novel.meta.slug),
    })),
  };
  return new Response(JSON.stringify(index), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
