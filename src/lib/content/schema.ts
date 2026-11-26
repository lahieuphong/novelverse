/**
 * Kiểu dữ liệu metadata của một truyện (content/novels/<slug>/novel.json).
 *
 * File này chỉ dùng import tương đối có đuôi .ts để chạy được cả trong Astro/Vite
 * lẫn trực tiếp bằng Node (scripts/check-content.ts).
 */
import { z } from "zod";

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const NOVEL_STATUSES = ["ongoing", "completed", "paused", "dropped"] as const;
export type NovelStatus = (typeof NOVEL_STATUSES)[number];

export const STATUS_LABELS: Record<NovelStatus, string> = {
  ongoing: "Đang ra",
  completed: "Hoàn thành",
  paused: "Tạm dừng",
  dropped: "Ngừng ra",
};

export const COVER_EXTENSIONS = [".avif", ".jpg", ".jpeg", ".png", ".webp"] as const;

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} không được để trống`);

export const novelMetaSchema = z.strictObject({
  /** Cho phép trỏ tới JSON Schema để editor gợi ý trường. */
  $schema: z.string().optional(),
  slug: z
    .string()
    .regex(SLUG_PATTERN, "slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang, ví dụ: tien-nghich"),
  title: nonEmpty("title"),
  altTitles: z.array(nonEmpty("altTitles[]")).default([]),
  author: nonEmpty("author"),
  genres: z.array(nonEmpty("genres[]")).min(1, "cần ít nhất một thể loại"),
  status: z.enum(NOVEL_STATUSES),
  description: nonEmpty("description"),
  /** Đường dẫn ảnh bìa, tương đối với thư mục chứa novel.json. */
  cover: nonEmpty("cover").optional(),
  /** Thư mục chương, tương đối với thư mục chứa novel.json. Mặc định: chapters */
  chaptersDir: nonEmpty("chaptersDir").default("chapters"),
  /** Ưu tiên hiển thị ở khu nổi bật trang chủ. */
  featured: z.boolean().default(false),
  /** Ngày cập nhật gần nhất (YYYY-MM-DD), dùng để sắp xếp "Mới cập nhật". */
  updatedAt: z.iso.date().optional(),
  source: z
    .strictObject({
      name: nonEmpty("source.name"),
      url: z.url({ protocol: /^https?$/, error: "source.url phải là địa chỉ http(s)" }).optional(),
      note: z.string().trim().optional(),
    })
    .optional(),
});

export type NovelMetaInput = z.input<typeof novelMetaSchema>;
export type NovelMeta = z.output<typeof novelMetaSchema>;

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "(gốc)";
    return `${path}: ${issue.message}`;
  });
}

/** JSON Schema cho editor (VS Code) – sinh từ cùng một schema zod. */
export function novelJsonSchema(): unknown {
  return z.toJSONSchema(novelMetaSchema, { io: "input" });
}
