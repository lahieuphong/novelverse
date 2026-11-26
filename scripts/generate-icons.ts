/**
 * Sinh favicon từ ảnh logo vuông (mặc định src/assets/brand/logo.webp) vào public/.
 *
 *   node scripts/generate-icons.ts [đường-dẫn-ảnh-vuông]
 *
 * Kết quả: favicon.ico (16/32/48) và favicon-32x32.png cắt tròn, nền trong suốt;
 * apple-touch-icon.png (180) để vuông vì iOS tự bo góc và tô đen phần trong suốt.
 * Logo ở header lấy trực tiếp src/assets/brand/logo.webp qua astro:assets, không cần chạy script này.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const source = path.resolve(root, process.argv[2] ?? "src/assets/brand/logo.webp");
const publicDir = path.join(root, "public");

const PNG_OPTIONS = { compressionLevel: 9, palette: true, quality: 90, effort: 10 } as const;
/** Vẽ ở kích thước gấp nhiều lần rồi thu nhỏ để mép tròn mịn (khử răng cưa) cả ở 16px. */
const SUPERSAMPLE = 4;

const square = (size: number) => sharp(source).resize(size, size, { fit: "cover" }).png(PNG_OPTIONS).toBuffer();

async function round(size: number): Promise<Buffer> {
  const big = size * SUPERSAMPLE;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${big}" height="${big}"><circle cx="${big / 2}" cy="${big / 2}" r="${big / 2}" fill="#fff"/></svg>`);
  const masked = await sharp(source)
    .resize(big, big, { fit: "cover" })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp(masked).resize(size, size, { kernel: "lanczos3" }).png(PNG_OPTIONS).toBuffer();
}

/** Đóng gói các ảnh PNG thành file .ico (định dạng ICO chứa PNG, mọi trình duyệt hiện đại đều đọc được). */
function packIco(images: Array<{ size: number; data: Buffer }>): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // số màu bảng màu
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(icoSizes.map(async (size) => ({ size, data: await round(size) })));
writeFileSync(path.join(publicDir, "favicon.ico"), packIco(icoImages));
writeFileSync(path.join(publicDir, "favicon-32x32.png"), await round(32));
writeFileSync(path.join(publicDir, "apple-touch-icon.png"), await square(180));

console.log(`Đã sinh favicon.ico (${icoSizes.join("/")}, tròn), favicon-32x32.png (tròn), apple-touch-icon.png từ ${path.relative(root, source)}`);
