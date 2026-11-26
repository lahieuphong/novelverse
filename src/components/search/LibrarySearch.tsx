/**
 * Ô tìm truyện ở /truyen (React island, hydrate khi rảnh).
 * - Danh sách truyện đã có sẵn trong HTML; island chỉ ẩn/hiện các thẻ theo kết quả.
 * - Chỉ mục metadata (/search-index.json) chỉ tải khi người dùng bắt đầu tìm; trong lúc chờ hiện Skeleton.
 * - Không có JS: form GET vẫn hiển thị toàn bộ danh sách.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { isSearchIndex, searchEntries, type SearchEntry } from "@/lib/search";

interface Props {
  indexUrl: string;
  actionUrl: string;
  /** id của lưới thẻ truyện render tĩnh. */
  gridId: string;
}

type Status = "idle" | "loading" | "ready" | "error";

function readQueryFromUrl(): string {
  try {
    return new URL(window.location.href).searchParams.get("q") ?? "";
  } catch {
    return "";
  }
}

function SkeletonCard() {
  return (
    <div className="flex gap-4 rounded-xl border bg-card p-3 sm:p-4" aria-hidden="true">
      <Skeleton className="aspect-[2/3] w-20 shrink-0 sm:w-24" />
      <div className="flex-1 space-y-3 pt-1">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

export default function LibrarySearch({ indexUrl, actionUrl, gridId }: Props) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const loading = useRef<Promise<void> | null>(null);

  const ensureIndex = useCallback(() => {
    if (loading.current) return loading.current;
    setStatus("loading");
    loading.current = fetch(indexUrl, { headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (!isSearchIndex(data)) throw new Error("Chỉ mục không hợp lệ");
        setEntries(data.novels);
        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
        loading.current = null;
      });
    return loading.current;
  }, [indexUrl]);

  // Đọc ?q= (từ form không JS hoặc Back/Forward) và focus khi vào bằng nút tìm ở header (#tim-kiem).
  useEffect(() => {
    const input = inputRef.current;
    // Ô nhập không bị React điều khiển: chữ người dùng gõ trước khi hydrate xong vẫn còn trong DOM.
    const initial = readQueryFromUrl() || input?.value || "";
    if (initial) {
      if (input) input.value = initial;
      setQuery(initial);
      void ensureIndex();
    }
    if (window.location.hash === "#tim-kiem") input?.focus();
    const onPop = () => {
      const value = readQueryFromUrl();
      if (inputRef.current) inputRef.current.value = value;
      setQuery(value);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [ensureIndex]);

  const trimmed = query.trim();
  const matches = useMemo(() => (entries && trimmed ? searchEntries(entries, trimmed) : null), [entries, trimmed]);
  const waiting = trimmed !== "" && status === "loading";

  // Ẩn/hiện thẻ truyện tĩnh theo kết quả.
  useEffect(() => {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const visible = matches ? new Set(matches.map((entry) => entry.slug)) : null;
    grid.hidden = waiting || (matches !== null && matches.length === 0);
    grid.querySelectorAll<HTMLElement>("[data-novel-card]").forEach((card) => {
      card.hidden = visible !== null && !visible.has(card.dataset.slug ?? "");
    });
  }, [gridId, matches, waiting]);

  const updateUrl = (value: string) => {
    try {
      const url = new URL(window.location.href);
      if (value.trim()) url.searchParams.set("q", value.trim());
      else url.searchParams.delete("q");
      url.hash = "";
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // bỏ qua
    }
  };

  let summary = "";
  if (trimmed && status === "error") summary = "Không tải được chỉ mục tìm kiếm. Hãy thử lại.";
  else if (matches) summary = matches.length ? `Tìm thấy ${matches.length} truyện cho “${trimmed}”.` : "";

  return (
    <div className="space-y-4">
      <form
        role="search"
        action={actionUrl}
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          void ensureIndex();
        }}
      >
        <label htmlFor="tim-kiem" className="mb-2 block text-sm font-medium">
          Tìm theo tên truyện hoặc tác giả
        </label>
        <div className="relative">
          <svg
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <Input
            ref={inputRef}
            id="tim-kiem"
            name="q"
            type="search"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Ví dụ: Tiên Nghịch, tien nghich, Nhĩ Căn…"
            className="h-12 rounded-lg bg-card pl-11 text-base md:text-base"
            defaultValue=""
            onFocus={() => void ensureIndex()}
            onChange={(event) => {
              setQuery(event.target.value);
              updateUrl(event.target.value);
              void ensureIndex();
            }}
          />
        </div>
      </form>

      <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
        {summary}
      </p>

      {waiting && (
        <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Đang tải kết quả">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {matches && matches.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-semibold">Không tìm thấy truyện phù hợp với “{trimmed}”.</p>
          <p className="mt-1 text-sm text-muted-foreground">Thử gõ tên khác, tên tác giả, hoặc gõ không dấu.</p>
          <button
            type="button"
            className="mt-4 inline-flex h-11 items-center rounded-md px-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              setQuery("");
              updateUrl("");
              inputRef.current?.focus();
            }}
          >
            Xóa từ khóa
          </button>
        </div>
      )}
    </div>
  );
}
