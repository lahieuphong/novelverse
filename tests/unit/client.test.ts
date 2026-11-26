import { describe, expect, it } from "vitest";
import { mergeProgress, parseProgress, type ProgressEntry } from "@/lib/client/progress";
import { parseSettings, parseTheme } from "@/lib/client/settings";
import { matchEntry, type SearchEntry } from "@/lib/search";
import { describeNotFound } from "@/scripts/not-found";

const entry = (chapter: number, updatedAt = 1): ProgressEntry => ({ chapter, label: `Chương ${chapter}`, paragraph: 3, updatedAt });

describe("tiến độ đọc", () => {
  it("bỏ dữ liệu cũ/sai định dạng", () => {
    expect(parseProgress(null)).toEqual({});
    expect(parseProgress("abc")).toEqual({});
    expect(parseProgress([1, 2])).toEqual({});
    expect(
      parseProgress({
        "tien-nghich": entry(28),
        "sai-kieu": { chapter: "28", label: "x", paragraph: 0, updatedAt: 1 },
        "am": { chapter: -1, label: "x", paragraph: 0, updatedAt: 1 },
        "Slug Sai": entry(1),
      }),
    ).toEqual({ "tien-nghich": entry(28) });
  });

  it("nhãn chương quá dài được cắt ngắn, không làm mất tiến độ", () => {
    const parsed = parseProgress({ "tien-nghich": { ...entry(28), label: "x".repeat(500) } });
    expect(parsed["tien-nghich"]?.chapter).toBe(28);
    expect(parsed["tien-nghich"]?.label).toHaveLength(200);
  });

  it("chỉ giữ 50 truyện gần nhất", () => {
    let map = {};
    for (let i = 0; i < 55; i++) map = mergeProgress(map, `truyen-${i}`, entry(1, i));
    const keys = Object.keys(map);
    expect(keys).toHaveLength(50);
    expect(keys).not.toContain("truyen-0");
    expect(keys).toContain("truyen-54");
  });
});

describe("cài đặt đọc", () => {
  it("giới hạn cỡ chữ và giãn dòng, bỏ giá trị sai kiểu", () => {
    expect(parseSettings({ fontSize: 99, lineHeight: 0.5 })).toEqual({ fontSize: 28, lineHeight: 1.3 });
    expect(parseSettings({ fontSize: "20", lineHeight: null })).toEqual({ fontSize: null, lineHeight: null });
    expect(parseSettings(undefined)).toEqual({ fontSize: null, lineHeight: null });
  });
  it("theme lạ quay về hệ thống", () => {
    expect(parseTheme("sepia")).toBe("sepia");
    expect(parseTheme("hong")).toBe("system");
    expect(parseTheme(null)).toBe("system");
  });
});

describe("tìm kiếm có dấu / không dấu", () => {
  const novel: SearchEntry = {
    slug: "tien-nghich",
    title: "Tiên Nghịch",
    altTitles: ["仙逆", "Renegade Immortal"],
    author: "Nhĩ Căn",
    genres: ["Tiên hiệp"],
    status: "Hoàn thành",
    chapters: 2082,
    url: "/truyen/tien-nghich/",
  };
  it.each(["Tiên Nghịch", "tien nghich", "TIEN", "nghịch", "tiennghich", "Nhĩ Căn", "nhi can", "仙逆", "renegade"])("khớp '%s'", (q) => {
    expect(matchEntry(novel, q)).toBe(true);
  });
  it.each(["Phàm Nhân", "tien hiep", "xyz"])("không khớp '%s'", (q) => {
    expect(matchEntry(novel, q)).toBe(false);
  });
});

describe("trang 404", () => {
  const data = {
    base: "/",
    pageSize: 50,
    novels: [
      {
        slug: "tien-nghich",
        title: "Tiên Nghịch",
        first: 1,
        last: 2088,
        missing: [
          [69, 69],
          [439, 439],
        ] as Array<[number, number]>,
        unavailable: [[1106, 1109]] as Array<[number, number]>,
        novelUrl: "/truyen/tien-nghich/",
        tocBase: "/truyen/tien-nghich/muc-luc/",
        chapterBase: "/truyen/tien-nghich/chuong/",
      },
    ],
  };
  it("chương thiếu dẫn về đúng trang mục lục", () => {
    expect(describeNotFound("/truyen/tien-nghich/chuong/69/", data)).toMatchObject({
      href: "/truyen/tien-nghich/muc-luc/2/#chuong-69",
      message: expect.stringContaining("chưa có trong dữ liệu nguồn"),
    });
    expect(describeNotFound("/truyen/tien-nghich/chuong/1107", data)).toMatchObject({
      href: "/truyen/tien-nghich/muc-luc/23/#chuong-1107",
      message: expect.stringContaining("chưa được cập nhật"),
    });
  });
  it("URL gõ sai của chương đọc được thì dẫn thẳng tới chương", () => {
    for (const url of ["/truyen/tien-nghich/chuong/0070/", "/truyen/tien-nghich/chuong/70/abc"]) {
      expect(describeNotFound(url, data)).toMatchObject({
        title: "Có phải bạn muốn đọc Chương 70?",
        href: "/truyen/tien-nghich/chuong/70/",
      });
    }
  });
  it("số chương vượt quá và URL lạ", () => {
    expect(describeNotFound("/truyen/tien-nghich/chuong/9999/", data)?.title).toBe("Không có chương 9999");
    expect(describeNotFound("/truyen/khong-co/chuong/1/", data)).toBeNull();
    expect(describeNotFound("/abc", data)).toBeNull();
  });
});
