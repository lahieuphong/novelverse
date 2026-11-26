/** localStorage an toàn: trả về null nếu trình duyệt chặn (chế độ riêng tư, cookie bị tắt…). */
let cached: Storage | null | undefined;

export function safeStorage(): Storage | null {
  if (cached !== undefined) return cached;
  try {
    const storage = window.localStorage;
    const probe = "__nv_probe__";
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    cached = storage;
  } catch {
    cached = null;
  }
  return cached;
}

export function readJson(key: string): unknown {
  const raw = safeStorage()?.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    safeStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Hết dung lượng hoặc bị chặn: bỏ qua, trang vẫn hoạt động.
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
