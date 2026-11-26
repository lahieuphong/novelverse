import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  chapterNeighbors,
  describeSkip,
  findChapter,
  novelStats,
  sortNovels,
  tocEntries,
  tocPageCount,
  tocPageOf,
} from "@/lib/content/catalog";
import { loadCatalog, readChapter } from "@/lib/content/loader";

const projectRoot = path.resolve(import.meta.dirname, "../..");

describe("Tiên Nghịch – dữ liệu thật trong chuong/", () => {
  const catalog = loadCatalog({ projectRoot, contentDirs: ["content/novels"] });
  const novel = catalog.novels.find((n) => n.meta.slug === "tien-nghich");

  it("được nạp, không có lỗi chặn build", () => {
    expect(novel).toBeDefined();
    expect(catalog.issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("thống kê khớp dữ liệu: 2088 chương, thiếu 69 và 439, 1106–1109 chưa cập nhật", () => {
    const stats = novelStats(novel!);
    expect(stats.lastNumber).toBe(2088);
    expect(stats.missing).toEqual([69, 439]);
    expect(stats.unavailable).toEqual([1106, 1107, 1108, 1109]);
    expect(stats.readable).toBe(2082);
    expect(stats.firstReadable?.number).toBe(1);
    expect(stats.lastReadable?.number).toBe(2088);
  });

  it("68 ↔ 70 bỏ qua chương thiếu và có câu giải thích", () => {
    const at68 = chapterNeighbors(novel!, 68);
    expect(at68.next?.number).toBe(70);
    expect(describeSkip(at68.skippedAfter, "next", 70)).toBe("Chương 69 chưa có trong dữ liệu nguồn nên chương sau là Chương 70.");
    const at70 = chapterNeighbors(novel!, 70);
    expect(at70.prev?.number).toBe(68);
    expect(describeSkip(at70.skippedBefore, "prev", 68)).toBe("Chương 69 chưa có trong dữ liệu nguồn nên chương trước là Chương 68.");
  });

  it("438 ↔ 440", () => {
    expect(chapterNeighbors(novel!, 438).next?.number).toBe(440);
    expect(chapterNeighbors(novel!, 440).prev?.number).toBe(438);
  });

  it("1105 ↔ 1110 nhảy qua 4 chương chưa cập nhật", () => {
    const at1105 = chapterNeighbors(novel!, 1105);
    expect(at1105.next?.number).toBe(1110);
    expect(at1105.skippedAfter.unavailable).toEqual([1106, 1107, 1108, 1109]);
    expect(describeSkip(at1105.skippedAfter, "next", 1110)).toBe(
      "Chương 1106–1109 chưa cập nhật nội dung nên chương sau là Chương 1110.",
    );
    expect(chapterNeighbors(novel!, 1110).prev?.number).toBe(1105);
  });

  it("chương 68 (nguồn ngắt dòng cứng): nối câu bị cắt trước tên riêng 'Tư Đồ / Nam'", () => {
    const { paragraphs } = readChapter(findChapter(novel!, 68)!);
    expect(paragraphs.some((p) => p.includes("Mãi cho đến khi Tư Đồ Nam đắc ý, mở miệng ra nói"))).toBe(true);
    expect(paragraphs.some((p) => p.endsWith("Tư Đồ"))).toBe(false);
  });

  it("chương 1 (không ngắt dòng cứng) giữ nguyên số đoạn của nguồn", () => {
    const { paragraphs } = readChapter(findChapter(novel!, 1)!);
    expect(paragraphs[0]).toMatch(/^Thiết Trụ ngồi ở bên con đường nhỏ trong thôn/);
    expect(paragraphs.at(-1)).toMatch(/lập tức lại nhiều lên không ít\.$/);
  });

  it("chương liền kề bình thường không có câu giải thích", () => {
    const at2 = chapterNeighbors(novel!, 2);
    expect([at2.prev?.number, at2.next?.number]).toEqual([1, 3]);
    expect(describeSkip(at2.skippedAfter, "next", 3)).toBeNull();
  });

  it("chương đầu không có trước, chương cuối không có sau", () => {
    expect(chapterNeighbors(novel!, 1).prev).toBeNull();
    expect(chapterNeighbors(novel!, 2088).next).toBeNull();
  });

  it("mục lục 50 chương/trang, giữ vị trí chương thiếu", () => {
    expect(tocPageCount(novel!)).toBe(42);
    expect(tocPageOf(novel!, 69)).toBe(2);
    expect(tocPageOf(novel!, 1106)).toBe(23);
    const page2 = tocEntries(novel!, 2);
    expect(page2).toHaveLength(50);
    expect(page2.find((e) => e.number === 69)).toEqual({ number: 69, name: null, status: "missing" });
    const page23 = tocEntries(novel!, 23);
    expect(page23.find((e) => e.number === 1106)?.status).toBe("placeholder");
    expect(tocEntries(novel!, 42).map((e) => e.number)).toEqual(Array.from({ length: 38 }, (_, i) => 2051 + i));
  });
});

describe("thêm truyện chỉ cần thêm dữ liệu", () => {
  it("fixture xuất hiện cùng truyện chính khi bật thêm thư mục", () => {
    const catalog = loadCatalog({ projectRoot, contentDirs: ["content/novels", "tests/fixtures/novels"] });
    expect(sortNovels(catalog.novels).map((n) => n.meta.slug)).toEqual(["tien-nghich", "truyen-thu-nghiem"]);
    const fixture = catalog.novels.find((n) => n.meta.slug === "truyen-thu-nghiem")!;
    const at2 = chapterNeighbors(fixture, 2);
    expect(at2.next?.number).toBe(5);
    expect(describeSkip(at2.skippedAfter, "next", 5)).toBe(
      "Chương 3 chưa có trong dữ liệu nguồn; Chương 4 chưa cập nhật nội dung nên chương sau là Chương 5.",
    );
  });

  it("truyện chưa có file chương: không có trang mục lục", () => {
    const novel = {
      meta: { slug: "rong" },
      dir: "",
      chaptersDir: "",
      coverFile: null,
      chapters: [],
    } as unknown as Parameters<typeof tocPageCount>[0];
    expect(tocPageCount(novel)).toBe(0);
    expect(novelStats(novel).readable).toBe(0);
  });

  it("danh mục chính mặc định không chứa truyện giả", () => {
    const catalog = loadCatalog({ projectRoot });
    expect(catalog.novels.map((n) => n.meta.slug)).toEqual(["tien-nghich"]);
  });
});
