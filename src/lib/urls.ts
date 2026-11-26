/** Tạo URL trong site – mọi route đi qua đây để thống nhất dấu "/" cuối và BASE_PATH. */
const rawBase = import.meta.env.BASE_URL ?? "/";
export const BASE = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

export const homeUrl = (): string => BASE;
export const libraryUrl = (): string => `${BASE}truyen/`;
export const searchIndexUrl = (): string => `${BASE}search-index.json`;
export const novelUrl = (slug: string): string => `${BASE}truyen/${slug}/`;
export const tocBaseUrl = (slug: string): string => `${BASE}truyen/${slug}/muc-luc/`;
export const tocUrl = (slug: string, page: number): string => `${tocBaseUrl(slug)}${page}/`;
export const chapterBaseUrl = (slug: string): string => `${BASE}truyen/${slug}/chuong/`;
export const chapterUrl = (slug: string, number: number): string => `${chapterBaseUrl(slug)}${number}/`;
/** id của một dòng trong mục lục, dùng cho liên kết #chuong-N. */
export const chapterAnchor = (number: number): string => `chuong-${number}`;
export const assetUrl = (file: string): string => `${BASE}${file.replace(/^\//, "")}`;
