#!/usr/bin/env python3
"""
Xuất text từng chương Tiên Nghịch từ truyendich.space (website của bạn).

Chỉ dùng thư viện chuẩn của Python 3.9+, không cần cài thêm gì.

Ví dụ:
    python crawl_truyendich.py                       # chương 1 → 2050
    python crawl_truyendich.py --start 1 --end 50    # thử 50 chương đầu
    python crawl_truyendich.py --merge-every 100     # thêm file gộp mỗi 100 chương

Kết quả (mặc định trong thư mục ./chuong cạnh script):
    chuong/chuong-0001.txt   "Chương 1: <tiêu đề>" + các đoạn văn, cách nhau một dòng trống
    chuong/index.csv         số chương, tiêu đề, số chữ, trạng thái
    chuong/gop/...           file gộp (nếu dùng --merge-every)

Chạy lại lệnh cũ để tiếp tục: chương đã có file sẽ được bỏ qua.
"""

from __future__ import annotations

import argparse
import csv
import html
import sys
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

DEFAULT_BASE = "https://truyendich.space/doc-truyen/tien-nghich/chuong-{n}"
USER_AGENT = "TruyenDich-OwnerExport/1.0 (site owner content export)"


class ChapterParser(HTMLParser):
    """Lấy tiêu đề (<h1>) và các đoạn <p> trong <section class="prose-novel">."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.paragraphs: list[str] = []
        self._in_h1 = False
        self._section_depth = 0  # >0 khi đang ở trong section prose-novel
        self._in_p = False
        self._current: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        classes = (dict(attrs).get("class") or "").split()
        if tag == "h1" and not self.title_parts:
            self._in_h1 = True
        if tag == "section":
            if self._section_depth > 0:
                self._section_depth += 1
            elif "prose-novel" in classes:
                self._section_depth = 1
        if self._section_depth > 0 and tag == "p":
            self._in_p = True
            self._current = []
        if self._in_p and tag == "br":
            self._current.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "h1":
            self._in_h1 = False
        if tag == "p" and self._in_p:
            text = " ".join("".join(self._current).split())
            if text:
                self.paragraphs.append(text)
            self._in_p = False
        if tag == "section" and self._section_depth > 0:
            self._section_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._in_h1:
            self.title_parts.append(data)
        if self._in_p:
            self._current.append(data)

    @property
    def title(self) -> str:
        return " ".join("".join(self.title_parts).split()).strip(" .")


def fetch(
    url: str, retries: int, timeout: float, extra_headers: dict[str, str] | None = None
) -> tuple[int, str]:
    """Trả về (mã HTTP, html). Tự thử lại khi 429/5xx/lỗi mạng."""
    delay = 5.0
    headers = {"User-Agent": USER_AGENT, **(extra_headers or {})}
    for attempt in range(retries + 1):
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                return response.status, response.read().decode(charset, "replace")
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return 404, ""
            if error.code not in (429, 500, 502, 503, 504) or attempt == retries:
                return error.code, ""
            wait = float(error.headers.get("Retry-After") or delay)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
            if attempt == retries:
                print(f"  lỗi mạng: {error}", file=sys.stderr)
                return 0, ""
            wait = delay
        print(f"  thử lại sau {wait:.0f}s ({attempt + 1}/{retries})", file=sys.stderr)
        time.sleep(wait)
        delay = min(delay * 2, 120)
    return 0, ""


def chapter_path(out: Path, n: int) -> Path:
    return out / f"chuong-{n:04d}.txt"


def read_index(path: Path) -> dict[int, list[str]]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8", newline="") as f:
        return {int(row[0]): row for row in csv.reader(f) if row and row[0].isdigit()}


def write_index(path: Path, rows: dict[int, list[str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["chuong", "tieu_de", "so_chu", "trang_thai"])
        for n in sorted(rows):
            writer.writerow(rows[n])


def merge(out: Path, start: int, end: int, every: int) -> None:
    folder = out / "gop"
    folder.mkdir(exist_ok=True)
    for first in range(start, end + 1, every):
        last = min(first + every - 1, end)
        parts = [chapter_path(out, n) for n in range(first, last + 1)]
        parts = [p for p in parts if p.exists()]
        if not parts:
            continue
        target = folder / f"chuong-{first:04d}-{last:04d}.txt"
        target.write_text(
            "\n\n\n".join(p.read_text(encoding="utf-8").strip() for p in parts) + "\n",
            encoding="utf-8",
        )
        print(f"gộp {len(parts)} chương → {target.name}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--end", type=int, default=2050)
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent / "chuong")
    parser.add_argument("--base", default=DEFAULT_BASE, help="mẫu URL, {n} là số chương")
    parser.add_argument("--delay", type=float, default=1.0, help="giây nghỉ giữa hai chương")
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--force", action="store_true", help="tải lại cả chương đã có")
    parser.add_argument("--stop-after-missing", type=int, default=10,
                        help="dừng khi gặp liên tiếp ngần này chương 404/trống")
    parser.add_argument("--merge-every", type=int, default=0, help="tạo thêm file gộp mỗi N chương")
    parser.add_argument("--header", action="append", default=[], metavar="'Tên: giá trị'",
                        help="header gửi kèm, ví dụ mã export bạn cấu hình trên server; dùng nhiều lần được")
    args = parser.parse_args()
    extra_headers = {}
    for item in args.header:
        name, _, value = item.partition(":")
        if not value:
            parser.error(f"--header phải có dạng 'Tên: giá trị' (nhận: {item!r})")
        extra_headers[name.strip()] = value.strip()

    args.out.mkdir(parents=True, exist_ok=True)
    index_path = args.out / "index.csv"
    index = read_index(index_path)
    missing_streak = 0
    saved = skipped = failed = 0

    try:
        for n in range(args.start, args.end + 1):
            target = chapter_path(args.out, n)
            if target.exists() and not args.force:
                skipped += 1
                continue

            status, page = fetch(args.base.format(n=n), args.retries, args.timeout, extra_headers)
            chapter = ChapterParser()
            if page:
                chapter.feed(page)

            if status == 200 and chapter.paragraphs:
                title = html.unescape(chapter.title) or f"Chương {n}"
                body = "\n\n".join(chapter.paragraphs)
                target.write_text(f"Chương {n}: {title}\n\n{body}\n", encoding="utf-8")
                words = len(body.split())
                index[n] = [str(n), title, str(words), "ok"]
                saved += 1
                missing_streak = 0
                print(f"[{n}] {title} — {words} chữ")
            else:
                if status != 200:
                    reason = f"http_{status}"
                elif "mystic-cipher" in page:
                    # The site's anti-crawler served scrambled text instead of the chapter.
                    reason = "bi_chan_chong_crawl"
                else:
                    reason = "khong_co_noi_dung"
                index[n] = [str(n), "", "0", reason]
                failed += 1
                missing_streak += 1
                print(f"[{n}] bỏ qua: {reason}", file=sys.stderr)
                if reason == "bi_chan_chong_crawl" and missing_streak >= 3:
                    print("Dừng: server trả bản mã hoá chống crawl. Hãy cho phép script trên server "
                          "(mã --header, whitelist IP) hoặc export từ database.", file=sys.stderr)
                    break
                if missing_streak >= args.stop_after_missing:
                    print(f"Dừng: {missing_streak} chương liên tiếp không có nội dung.", file=sys.stderr)
                    break

            if n % 25 == 0:
                write_index(index_path, index)
            time.sleep(args.delay)
    except KeyboardInterrupt:
        print("\nĐã dừng (Ctrl+C). Chạy lại lệnh để tiếp tục.", file=sys.stderr)
    finally:
        write_index(index_path, index)

    print(f"Xong: {saved} chương mới, {skipped} đã có, {failed} lỗi. Thư mục: {args.out}")
    if args.merge_every > 0:
        merge(args.out, args.start, args.end, args.merge_every)
    return 0


if __name__ == "__main__":
    sys.exit(main())
