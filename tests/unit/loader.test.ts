import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hasErrors, loadCatalog, readChapter, type Catalog } from "@/lib/content/loader";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Tạo một "dự án" tạm với cấu trúc content/novels/<slug>/... */
function makeProject(files: Record<string, string | Uint8Array>): string {
  const root = mkdtempSync(path.join(tmpdir(), "novelverse-"));
  temps.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

const meta = (slug: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ slug, title: `Truyện ${slug}`, author: "Tác giả", genres: ["Thử"], status: "ongoing", description: "Mô tả.", ...extra });

const codes = (catalog: Catalog) => catalog.issues.map((issue) => `${issue.level}:${issue.code}`);

describe("loadCatalog – fixture truyện thứ hai", () => {
  const catalog = loadCatalog({ projectRoot, contentDirs: ["tests/fixtures/novels"] });
  const novel = catalog.novels[0];

  it("tự phát hiện truyện từ cây thư mục", () => {
    expect(catalog.novels.map((n) => n.meta.slug)).toEqual(["truyen-thu-nghiem"]);
    expect(hasErrors(catalog.issues)).toBe(false);
    expect(novel?.coverFile).toMatch(/cover\.png$/);
  });

  it("sắp xếp theo số, phát hiện khoảng thiếu, placeholder, title lệch số và file bị bỏ qua", () => {
    expect(novel?.chapters.map((c) => [c.number, c.status])).toEqual([
      [1, "ok"],
      [2, "ok"],
      [4, "placeholder"],
      [5, "ok"],
      [6, "ok"],
    ]);
    expect(codes(catalog)).toEqual(
      expect.arrayContaining([
        "warning:chapters-missing",
        "warning:chapters-placeholder",
        "warning:title-number-mismatch",
        "info:title-missing",
        "info:file-ignored",
      ]),
    );
    expect(catalog.issues.find((i) => i.code === "chapters-missing")?.chapters).toEqual([3]);
  });

  it("chương 1 có BOM + CRLF: tách tiêu đề, bỏ tiêu đề lặp, nối câu gãy, giữ ngắt dòng bài thơ", () => {
    const chapter = novel?.chapters[0];
    expect(chapter?.name).toBe("Khởi đầu");
    const parsed = readChapter(chapter!);
    expect(parsed.paragraphs).toEqual([
      "Sáng sớm, sương mù phủ kín cả thung lũng phía sau núi.",
      "- Ngươi đến rồi sao?",
      "- Ta đến rồi.",
      "Bài thơ trên vách đá:\nNúi cao vạn trượng\nNước chảy ngàn năm",
    ]);
  });

  it("chương lệch số vẫn dùng số theo tên file, tên lấy từ dòng tiêu đề", () => {
    const chapter = novel?.chapters.find((c) => c.number === 5);
    expect(chapter?.name).toBe("Lệch số");
  });
});

describe("loadCatalog – lỗi dừng build", () => {
  it("hai file cùng số chương là lỗi xung đột route", () => {
    const root = makeProject({
      "content/novels/a/novel.json": meta("a"),
      "content/novels/a/chapters/1.txt": "Chương 1: A\n\nNội dung.",
      "content/novels/a/chapters/0001.txt": "Chương 1: B\n\nNội dung.",
    });
    const catalog = loadCatalog({ projectRoot: root });
    expect(codes(catalog)).toContain("error:duplicate-chapter-number");
    expect(hasErrors(catalog.issues)).toBe(true);
  });

  it("trùng slug giữa hai thư mục là lỗi", () => {
    const root = makeProject({
      "content/novels/a/novel.json": meta("trung"),
      "content/novels/a/chapters/1.txt": "Nội dung.",
      "content/novels/b/novel.json": meta("trung"),
      "content/novels/b/chapters/1.txt": "Nội dung.",
    });
    const catalog = loadCatalog({ projectRoot: root });
    expect(codes(catalog)).toEqual(expect.arrayContaining(["error:duplicate-slug", "warning:slug-folder-mismatch"]));
  });

  it("file không phải UTF-8 là lỗi không đọc được", () => {
    const root = makeProject({
      "content/novels/a/novel.json": meta("a"),
      "content/novels/a/chapters/1.txt": new Uint8Array([0x43, 0x68, 0xff, 0xfe, 0x20]),
    });
    expect(codes(loadCatalog({ projectRoot: root }))).toContain("error:file-unreadable");
  });

  it("novel.json hỏng hoặc thiếu trường bắt buộc là lỗi", () => {
    const broken = makeProject({
      "content/novels/a/novel.json": "{ slug: a",
      "content/novels/a/chapters/1.txt": "x",
    });
    expect(codes(loadCatalog({ projectRoot: broken }))).toContain("error:novel-json-invalid");

    const missing = makeProject({
      "content/novels/a/novel.json": JSON.stringify({ slug: "a", title: "A" }),
      "content/novels/a/chapters/1.txt": "x",
    });
    const catalog = loadCatalog({ projectRoot: missing });
    expect(codes(catalog)).toContain("error:novel-meta-invalid");
    expect(catalog.issues[0]?.message).toMatch(/author/);
  });

  it("slug sai định dạng và chaptersDir trỏ ra ngoài dự án là lỗi", () => {
    const badSlug = makeProject({
      "content/novels/a/novel.json": meta("Tiên Nghịch"),
      "content/novels/a/chapters/1.txt": "x",
    });
    expect(codes(loadCatalog({ projectRoot: badSlug }))).toContain("error:novel-meta-invalid");

    const outside = makeProject({
      "content/novels/a/novel.json": meta("a", { chaptersDir: "../../../../.." }),
    });
    expect(codes(loadCatalog({ projectRoot: outside }))).toContain("error:chapters-dir-outside-project");
  });

  it("thư mục thiếu novel.json chỉ là cảnh báo, không dừng build", () => {
    const root = makeProject({
      "content/novels/dang-soan/chapters/1.txt": "x",
      "content/novels/a/novel.json": meta("a"),
      "content/novels/a/chapters/1.txt": "Nội dung.",
    });
    const catalog = loadCatalog({ projectRoot: root });
    expect(codes(catalog)).toContain("warning:novel-json-missing");
    expect(hasErrors(catalog.issues)).toBe(false);
  });

  it("chương chỉ lặp lại tiêu đề là chương rỗng, không sinh trang trống", () => {
    const root = makeProject({
      "content/novels/a/novel.json": meta("a"),
      "content/novels/a/chapters/1.txt": "Chương 1: Mở đầu\n\nNội dung thật.",
      "content/novels/a/chapters/2.txt": "Chương 2: Tên\n\nTên\n",
    });
    const catalog = loadCatalog({ projectRoot: root });
    expect(catalog.novels[0]?.chapters.map((c) => [c.number, c.status])).toEqual([
      [1, "ok"],
      [2, "empty"],
    ]);
  });

  it("file lạc có số chương bất thường là lỗi và bị loại khỏi danh mục", () => {
    const root = makeProject({
      "content/novels/a/novel.json": meta("a"),
      "content/novels/a/chapters/0001.txt": "Nội dung.",
      "content/novels/a/chapters/0002.txt": "Nội dung.",
      "content/novels/a/chapters/backup_20241126.txt": "Nội dung.",
    });
    const catalog = loadCatalog({ projectRoot: root });
    expect(codes(catalog)).toContain("error:chapter-number-outlier");
    expect(catalog.novels[0]?.chapters.map((c) => c.number)).toEqual([1, 2]);
    expect(codes(catalog)).not.toContain("warning:chapters-missing");
  });

  it("ảnh bìa khác chữ hoa/thường vẫn tìm đúng file trên đĩa", () => {
    const root = makeProject({
      "content/novels/a/novel.json": meta("a", { cover: "bia.jpg" }),
      "content/novels/a/BIA.JPG": new Uint8Array([0xff, 0xd8, 0xff]),
      "content/novels/a/chapters/1.txt": "Nội dung.",
    });
    const catalog = loadCatalog({ projectRoot: root });
    expect(path.basename(catalog.novels[0]?.coverFile ?? "")).toBe("BIA.JPG");
  });

  it("ảnh bìa của truyện ngoài thư mục được build xử lý thì cảnh báo và dùng bìa chữ", () => {
    const root = makeProject({
      "khac/novels/a/novel.json": meta("a", { cover: "cover.png" }),
      "khac/novels/a/cover.png": new Uint8Array([0x89, 0x50]),
      "khac/novels/a/chapters/1.txt": "Nội dung.",
    });
    const catalog = loadCatalog({ projectRoot: root, contentDirs: ["khac/novels"] });
    expect(codes(catalog)).toContain("warning:cover-unsupported");
    expect(catalog.novels[0]?.coverFile).toBeNull();
  });

  it("source.url chỉ nhận http(s)", () => {
    const root = makeProject({
      "content/novels/a/novel.json": meta("a", { source: { name: "x", url: "javascript:alert(1)" } }),
      "content/novels/a/chapters/1.txt": "Nội dung.",
    });
    const catalog = loadCatalog({ projectRoot: root });
    expect(codes(catalog)).toContain("error:novel-meta-invalid");
    expect(catalog.issues[0]?.message).toMatch(/http\(s\)/);
  });

  it("ảnh bìa khai báo nhưng không có file thì dùng bìa chữ", () => {
    const root = makeProject({
      "content/novels/a/novel.json": meta("a", { cover: "khong-co.jpg" }),
      "content/novels/a/chapters/1.txt": "Nội dung.",
    });
    const catalog = loadCatalog({ projectRoot: root });
    expect(codes(catalog)).toContain("warning:cover-missing");
    expect(catalog.novels[0]?.coverFile).toBeNull();
  });
});
