/**
 * Ảnh bìa đặt cạnh novel.json được xử lý bằng astro:assets (resize, webp, width/height cố định).
 * Glob phải là chuỗi cố định. Ảnh trong tests/fixtures chỉ được đưa vào bản build thử
 * (__NOVELVERSE_FIXTURE_COVERS__ do astro.config.ts định nghĩa), nên không lọt vào dist/ thật.
 */
import path from "node:path";
import type { ImageMetadata } from "astro";
import type { NovelRecord } from "./loader.ts";
import { getCatalog } from "./catalog.ts";

type CoverLoaders = Record<string, () => Promise<{ default: ImageMetadata }>>;

const contentCovers: CoverLoaders = import.meta.glob<{ default: ImageMetadata }>("/content/novels/*/*.{avif,jpg,jpeg,png,webp,AVIF,JPG,JPEG,PNG,WEBP}");
const fixtureCovers: CoverLoaders = __NOVELVERSE_FIXTURE_COVERS__
  ? import.meta.glob<{ default: ImageMetadata }>("/tests/fixtures/novels/*/*.{avif,jpg,jpeg,png,webp,AVIF,JPG,JPEG,PNG,WEBP}")
  : {};

export async function loadCover(novel: NovelRecord): Promise<ImageMetadata | null> {
  if (!novel.coverFile) return null;
  const key = `/${path.relative(getCatalog().projectRoot, novel.coverFile).split(path.sep).join("/")}`;
  const loader = contentCovers[key] ?? fixtureCovers[key];
  if (!loader) return null;
  return (await loader()).default;
}
