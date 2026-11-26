import { describe, expect, it } from "vitest";
import {
  classifyBody,
  compressRanges,
  decodeUtf8,
  estimateWrapWidth,
  excerpt,
  foldVietnamese,
  formatRanges,
  parseChapterNumberFromFileName,
  parseChapterText,
  parseTitleLine,
} from "@/lib/content/text";

describe("decodeUtf8", () => {
  it("bỏ BOM đầu file", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Chương 1")]);
    expect(decodeUtf8(bytes)).toBe("Chương 1");
  });
  it("ném lỗi với byte UTF-8 không hợp lệ", () => {
    expect(() => decodeUtf8(new Uint8Array([0x43, 0xff, 0xfe]))).toThrow();
  });
});

describe("parseChapterNumberFromFileName", () => {
  it.each([
    ["chuong_0001.txt", 1],
    ["chuong-0069.txt", 69],
    ["0012.txt", 12],
    ["chapter 2088.TXT", 2088],
    ["quyen-2-chuong-15.txt", 15],
  ])("%s -> %d", (name, expected) => {
    expect(parseChapterNumberFromFileName(name)).toBe(expected);
  });
  it("trả null khi không có số hoặc không phải .txt", () => {
    expect(parseChapterNumberFromFileName("loi-mo-dau.txt")).toBeNull();
    expect(parseChapterNumberFromFileName("0001.md")).toBeNull();
  });
});

describe("parseTitleLine", () => {
  it("tách số và tên, gộp khoảng trắng thừa", () => {
    expect(parseTitleLine("Chương 681:  Vương Bình")).toEqual({ number: 681, name: "Vương Bình" });
    expect(parseTitleLine("Chương 2088: Bỗng nhiên quay đầu (kết cục)")).toEqual({ number: 2088, name: "Bỗng nhiên quay đầu (kết cục)" });
    expect(parseTitleLine("Chuong 5 - Ten")).toEqual({ number: 5, name: "Ten" });
    expect(parseTitleLine("Chương 7")).toEqual({ number: 7, name: null });
  });
  it("không nhận câu văn thường là tiêu đề", () => {
    expect(parseTitleLine("Thiết Trụ ngồi ở bên con đường nhỏ")).toBeNull();
  });
  it("'Hồi' chỉ là tiêu đề khi có dấu phân cách hoặc đứng một mình", () => {
    expect(parseTitleLine("Hồi 5 tuổi, hắn đã theo cha lên núi đốn củi.")).toBeNull();
    expect(parseTitleLine("Hồi 3: Ra núi")).toEqual({ number: 3, name: "Ra núi" });
    expect(parseTitleLine("Hồi 3")).toEqual({ number: 3, name: null });
    expect(parseChapterText("Hồi 5 tuổi, hắn đã theo cha lên núi.\n\nĐoạn hai.").paragraphs).toEqual([
      "Hồi 5 tuổi, hắn đã theo cha lên núi.",
      "Đoạn hai.",
    ]);
  });
  it("dòng quá dài sau 'Chương N' là câu văn, không phải tiêu đề", () => {
    expect(parseTitleLine(`Chương 1 ${"rất dài ".repeat(30)}`)).toBeNull();
  });
});

describe("parseChapterText", () => {
  it("hỗ trợ CRLF, tách tiêu đề khỏi thân và giữ dấu tiếng Việt", () => {
    const parsed = parseChapterText("Chương 1: Ly hương.\r\n\r\nĐoạn một.\r\n\r\n- Hội thoại!\r\n");
    expect(parsed.title).toEqual({ number: 1, name: "Ly hương." });
    expect(parsed.paragraphs).toEqual(["Đoạn một.", "- Hội thoại!"]);
  });

  it("nối câu bị ngắt đôi giữa hai đoạn", () => {
    const parsed = parseChapterText(
      "Chương 28: Tạp vụ\n\nHắc y tượng trưng cho một người có thực lực rất\n\ncao. Hắn cung kính nói:\n\n- Tham kiến sư huynh!",
    );
    expect(parsed.paragraphs).toEqual([
      "Hắc y tượng trưng cho một người có thực lực rất cao. Hắn cung kính nói:",
      "- Tham kiến sư huynh!",
    ]);
  });

  it("không nối khi đoạn trước kết thúc bằng dấu câu hoặc đoạn sau là hội thoại/viết hoa", () => {
    const parsed = parseChapterText("Hắn đứng dậy.\n\nrồi bước đi.\n\nHắn nói\n\n- Đi thôi\n\nNgười kia\n\nVương Lâm gật đầu.");
    expect(parsed.paragraphs).toEqual(["Hắn đứng dậy.", "rồi bước đi.", "Hắn nói", "- Đi thôi", "Người kia", "Vương Lâm gật đầu."]);
  });

  it("chương bị ngắt dòng cứng: nối cả chỗ cắt trước tên riêng viết hoa khi dòng trước dài đúng độ rộng ngắt", () => {
    const wrap = (text: string) => text.padEnd(70, "x").slice(0, 70);
    const a = wrap("Một dòng bị ngắt cứng theo độ rộng cố định của nguồn văn bản này nhé");
    const raw = [
      "Chương 9: Thử",
      `${a}`,
      "rồi tiếp tục.",
      `${a}`,
      "rồi tiếp tục.",
      `${a}`,
      "rồi tiếp tục.",
      "Nửa khắc trôi qua mà hắn cứ cảm giác như đã cả ngàn năm. Mãi cho đến khi Tư Đồ".padEnd(70, " ").trimEnd(),
      "Nam đắc ý, mở miệng ra nói.",
      "Hy vọng hắn có thể được toại nguyện",
      "Thần sắc Vương Lâm có chút cổ quái.",
    ].join("\n\n");
    const { paragraphs } = parseChapterText(raw);
    expect(paragraphs).toContain("Nửa khắc trôi qua mà hắn cứ cảm giác như đã cả ngàn năm. Mãi cho đến khi Tư Đồ Nam đắc ý, mở miệng ra nói.");
    // Dòng ngắn thiếu dấu chấm không bị nối với đoạn sau.
    expect(paragraphs).toContain("Hy vọng hắn có thể được toại nguyện");
  });

  it("không có bằng chứng ngắt dòng cứng thì không nối đoạn viết hoa", () => {
    expect(estimateWrapWidth(["Hắn nói", "Vương Lâm gật đầu."])).toBeNull();
    expect(parseChapterText("Mãi cho đến khi Tư Đồ\n\nNam đắc ý.").paragraphs).toEqual(["Mãi cho đến khi Tư Đồ", "Nam đắc ý."]);
  });

  it("chuẩn hóa tab trong gạch đầu dòng hội thoại", () => {
    expect(parseChapterText("-\tTa đã sưu tập được.").paragraphs).toEqual(["- Ta đã sưu tập được."]);
  });

  it("giữ ngắt dòng có ý nghĩa bên trong một đoạn", () => {
    const parsed = parseChapterText("Bài thơ:\nNúi cao vạn trượng\nNước chảy ngàn năm");
    expect(parsed.paragraphs).toEqual(["Bài thơ:\nNúi cao vạn trượng\nNước chảy ngàn năm"]);
  });

  it("bỏ đoạn đầu lặp lại tiêu đề", () => {
    expect(parseChapterText("Chương 3: Trắc thí\n\nTrắc thí\n\nNội dung.").paragraphs).toEqual(["Nội dung."]);
    expect(parseChapterText("Chương 3: Trắc thí\n\nChương 3: Trắc thí\n\nNội dung.").paragraphs).toEqual(["Nội dung."]);
  });

  it("không có dòng tiêu đề thì toàn bộ là thân chương", () => {
    const parsed = parseChapterText("Gió thổi.\n\nLá rơi.");
    expect(parsed.title).toBeNull();
    expect(parsed.paragraphs).toEqual(["Gió thổi.", "Lá rơi."]);
  });
});

describe("classifyBody", () => {
  it.each(["Chưa update", "Đang cập nhật...", "chưa cập nhật", "Nội dung đang được cập nhật", "Coming soon", "(chương này chưa có nội dung)"])(
    "'%s' là placeholder",
    (body) => expect(classifyBody(body)).toBe("placeholder"),
  );
  it("thân rỗng hoặc chỉ có dấu câu là empty", () => {
    expect(classifyBody("")).toBe("empty");
    expect(classifyBody("  \n ... \n")).toBe("empty");
  });
  it("văn bản dài có cụm 'chưa cập nhật' vẫn là nội dung thật", () => {
    const long = `${"Hắn nói rằng tin tức vẫn chưa cập nhật tới tông môn. ".repeat(6)}`;
    expect(classifyBody(long)).toBe("ok");
  });
  it("đoạn ngắn bình thường là ok", () => {
    expect(classifyBody("Hắn mỉm cười.")).toBe("ok");
  });
});

describe("tiện ích", () => {
  it("foldVietnamese bỏ dấu, đ -> d", () => {
    expect(foldVietnamese("Tiên Nghịch – Nhĩ Căn, Đạo")).toBe("tien nghich – nhi can, dao");
  });
  it("compressRanges / formatRanges", () => {
    expect(compressRanges([1109, 69, 1106, 1107, 439, 1108])).toEqual([
      [69, 69],
      [439, 439],
      [1106, 1109],
    ]);
    expect(formatRanges([69, 439, 1106, 1107, 1108, 1109])).toBe("69, 439, 1106–1109");
  });
  it("excerpt cắt ở ranh giới từ", () => {
    const text = excerpt(["Một hai ba bốn năm sáu bảy tám chín mười mười một mười hai"], 30);
    expect(text.length).toBeLessThanOrEqual(30);
    expect(text.endsWith("…")).toBe(true);
  });
});
