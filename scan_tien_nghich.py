"""
Scan truyện Tiên Nghịch trên tamhoan.com bằng Selenium, mỗi chương xuất ra 1 file .txt.

Cách chạy:
    pip install selenium
    python scan_tien_nghich.py                 # scan chương 1 -> 2088 (chạy ẩn trình duyệt)
    python scan_tien_nghich.py --show          # hiện cửa sổ Chrome để xem
    python scan_tien_nghich.py --end 10        # chỉ scan tới chương 10 (để thử)
    python scan_tien_nghich.py --restart       # bỏ tiến độ cũ, scan lại từ chương 1

Script tự lưu tiến độ vào progress.json -> nếu bị dừng giữa chừng, chạy lại sẽ tiếp tục
từ chương đang dở. ID chương trên web KHÔNG liên tục, nên script đi theo nút "chương sau"
(#next_chap) thay vì tự tăng ID.
"""

import argparse
import json
import random
import re
import sys
import time
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, TimeoutException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

START_URL = "https://tamhoan.com/tien-nghich/203612"  # Chương 1
END_CHAPTER = 2088

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "chuong"
PROGRESS_FILE = BASE_DIR / "progress.json"

MAX_RETRIES = 5
DELAY_RANGE = (1.0, 2.0)  # nghỉ giữa các chương (giây) để không spam server
RESTART_BROWSER_EVERY = 200  # mở lại Chrome định kỳ cho đỡ ngốn RAM / treo

# Chữ của khối quảng cáo Google chèn giữa nội dung
AD_TEXTS = {"Khám phá thêm", "Đọc Sách Điện Tử", "Đọc Sách Hay", "Mua Truyện Tranh"}

AD_FREE_EXTRACT_JS = """
const content = document.querySelector('div.content');
const clone = content.cloneNode(true);
clone.querySelectorAll(
  'ins, script, style, iframe, [class*="google"], [class*="adsbygoogle"], [id*="google_ads"]'
).forEach(el => el.remove());
const h2 = clone.querySelector('h2');
const title = h2 ? h2.textContent : '';
const paras = Array.from(clone.querySelectorAll('p')).map(p => p.textContent);
return [title, paras];
"""


def make_driver(show: bool) -> webdriver.Chrome:
    opts = webdriver.ChromeOptions()
    if not show:
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1280,900")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--log-level=3")
    opts.add_experimental_option("excludeSwitches", ["enable-logging"])
    # Không tải ảnh cho nhanh
    opts.add_experimental_option("prefs", {"profile.managed_default_content_settings.images": 2})
    # Không chờ quảng cáo/script phụ tải xong, chỉ cần DOM sẵn sàng
    opts.page_load_strategy = "eager"
    driver = webdriver.Chrome(options=opts)  # Selenium Manager tự tải chromedriver
    driver.set_page_load_timeout(60)
    return driver


def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
    return {"next_url": START_URL, "next_index": 1}


def save_progress(next_url: str | None, next_index: int) -> None:
    PROGRESS_FILE.write_text(
        json.dumps({"next_url": next_url, "next_index": next_index}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def scrape_chapter(driver: webdriver.Chrome, url: str) -> tuple[str, list[str], str | None]:
    """Trả về (tiêu đề, danh sách đoạn văn, url chương sau hoặc None)."""
    try:
        driver.get(url)
    except TimeoutException:
        # Trang tải quá lâu (thường do quảng cáo) -> dừng tải, dùng phần DOM đã có
        driver.execute_script("window.stop();")
    WebDriverWait(driver, 30).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "div.content h2"))
    )

    # Lấy tiêu đề + các đoạn bằng JS trên bản sao của div.content, đã gỡ quảng cáo Google chèn vào
    title, raw = driver.execute_script(AD_FREE_EXTRACT_JS)
    title = (title or "").strip()
    paragraphs = []
    for text in raw:
        text = text.strip()
        if text and text not in AD_TEXTS:
            paragraphs.append(text)

    next_url = None
    try:
        a = driver.find_element(By.ID, "next_chap")
        href = a.get_attribute("href")
        if href and "disabled" not in (a.get_attribute("class") or "") and href.startswith("http"):
            next_url = href
    except NoSuchElementException:
        pass

    return title, paragraphs, next_url


def chapter_number(title: str, fallback: int) -> int:
    m = re.search(r"Chương\s*(\d+)", title, re.IGNORECASE)
    return int(m.group(1)) if m else fallback


def write_chapter(num: int, title: str, paragraphs: list[str]) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"chuong_{num:04d}.txt"
    body = "\n\n".join(paragraphs)
    path.write_text(f"{title}\n\n{body}\n", encoding="utf-8")
    return path


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)  # in log ngay, kể cả khi ghi ra file

    parser = argparse.ArgumentParser(description="Scan Tiên Nghịch từ tamhoan.com ra file txt")
    parser.add_argument("--end", type=int, default=END_CHAPTER, help="chương cuối cần scan (mặc định 2088)")
    parser.add_argument("--show", action="store_true", help="hiện cửa sổ trình duyệt")
    parser.add_argument("--restart", action="store_true", help="bỏ tiến độ cũ, scan lại từ chương 1")
    args = parser.parse_args()

    progress = {"next_url": START_URL, "next_index": 1} if args.restart else load_progress()
    url, index = progress["next_url"], progress["next_index"]

    if not url:
        print("Đã scan xong hết rồi. Dùng --restart nếu muốn scan lại.")
        return

    print(f"Bắt đầu từ trang thứ #{index}: {url}")
    driver = make_driver(args.show)
    gaps = []  # các chỗ số chương bị nhảy (web thiếu/gộp chương)
    last_num = None
    reached_end = False
    scraped_since_restart = 0
    try:
        while url:
            if scraped_since_restart >= RESTART_BROWSER_EVERY:
                driver.quit()
                driver = make_driver(args.show)
                scraped_since_restart = 0

            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    title, paragraphs, next_url = scrape_chapter(driver, url)
                    if not paragraphs:
                        raise ValueError("không lấy được nội dung")
                    break
                except (TimeoutException, WebDriverException, ValueError) as e:
                    msg = str(e).split("\n")[0]  # bỏ stacktrace dài của chromedriver
                    print(f"  [!] Lỗi ở {url} (lần {attempt}/{MAX_RETRIES}): {type(e).__name__} {msg}")
                    if attempt == MAX_RETRIES:
                        raise
                    # Phiên Chrome có thể bị treo -> mở lại trình duyệt mới rồi thử lại
                    try:
                        driver.quit()
                    except Exception:
                        pass
                    time.sleep(5 * attempt)
                    driver = make_driver(args.show)
                    scraped_since_restart = 0
            scraped_since_restart += 1

            num = chapter_number(title, last_num + 1 if last_num else index)
            if num > args.end:
                reached_end = True
                break

            path = write_chapter(num, title, paragraphs)
            print(f"[{num}/{args.end}] {title}  ->  {path.name} ({len(paragraphs)} đoạn)")

            if last_num is not None and num != last_num + 1:
                gaps.append((last_num, num))
            last_num = num

            index += 1
            url = next_url
            save_progress(url, index)

            if num >= args.end:
                reached_end = True
                break
            if url:
                time.sleep(random.uniform(*DELAY_RANGE))
    except KeyboardInterrupt:
        print("\nĐã dừng. Chạy lại script để tiếp tục từ chỗ dở.")
    except Exception as e:
        msg = str(e).split("\n")[0]
        print(f"\nDừng vì lỗi: {type(e).__name__} {msg}\nChạy lại script để tiếp tục từ chỗ dở (trang #{index}).")
    finally:
        try:
            driver.quit()
        except Exception:
            pass

    if gaps:
        print("\nLưu ý: số chương bị nhảy ở các chỗ sau (web thiếu hoặc gộp chương):")
        for a, b in gaps:
            print(f"  chương {a} -> chương {b}")

    if reached_end:
        print(f"\nĐã scan xong tới chương {args.end}.")
    elif not url:
        print("\nKhông còn chương sau trên web -> đã tới chương cuối.")
    print(f"File txt nằm ở: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
