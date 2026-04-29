/**
 * Gộp các lời gọi song song cùng một key thành một Promise (một request HTTP).
 * Dùng khi React Strict Mode chạy effect hai lần hoặc nhiều thành phần cùng fetch.
 */
const inflight = new Map<string, Promise<unknown>>();

export function inFlightDedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing !== undefined) {
    return existing as Promise<T>;
  }
  const p = factory().finally(() => {
    if (inflight.get(key) === p) {
      inflight.delete(key);
    }
  });
  inflight.set(key, p);
  return p as Promise<T>;
}
