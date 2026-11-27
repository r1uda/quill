export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
export const DATA_KEY = "qingri:data:v1";
interface Head {
  format: "qingri-chunks-v1";
  generation: string;
  parts: number;
  length: number;
}
function isHead(x: unknown): x is Head {
  const h = x as Head;
  return (
    !!h &&
    h.format === "qingri-chunks-v1" &&
    typeof h.generation === "string" &&
    /^[a-z0-9-]+$/.test(h.generation) &&
    Number.isInteger(h.parts) &&
    h.parts > 0 &&
    h.parts <= 100 &&
    Number.isInteger(h.length)
  );
}
const partKey = (h: Head, index: number) =>
  `${DATA_KEY}:${h.generation}:${index}`;
export async function readSnapshot(
  storage: KeyValueStorage,
): Promise<string | null> {
  const raw = await storage.getItem(DATA_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!isHead(parsed)) return raw;
  const parts = await Promise.all(
    Array.from({ length: parsed.parts }, (_, i) =>
      storage.getItem(partKey(parsed, i)),
    ),
  );
  if (parts.some((p) => p === null))
    throw new Error("本机数据有缺失，请从备份恢复");
  const joined = parts.join("");
  if (joined.length !== parsed.length)
    throw new Error("本机数据长度不一致，请从备份恢复");
  return joined;
}
export async function writeSnapshot(
  storage: KeyValueStorage,
  snapshot: string,
): Promise<void> {
  // Limit individual entries, including UTF-8 expansion of Chinese characters.
  const size = 120000;
  const chunks: string[] = [];
  for (let start = 0; start < snapshot.length;) {
    let end = Math.min(start + size, snapshot.length);
    const last = snapshot.charCodeAt(end - 1);
    if (end < snapshot.length && last >= 0xd800 && last <= 0xdbff) end--;
    chunks.push(snapshot.slice(start, end));
    start = end;
  }
  if (!chunks.length) chunks.push("");
  const head: Head = {
    format: "qingri-chunks-v1",
    generation:
      Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10),
    parts: chunks.length,
    length: snapshot.length,
  };
  if (head.parts > 100)
    throw new Error("本机数据过大，请导出备份并缩小背景图片");
  const previous = await storage.getItem(DATA_KEY);
  const written: string[] = [];
  try {
    for (let i = 0; i < head.parts; i++) {
      const key = partKey(head, i);
      await storage.setItem(key, chunks[i]);
      written.push(key);
    }
    await storage.setItem(DATA_KEY, JSON.stringify(head));
  } catch (error) {
    await Promise.allSettled(written.map((key) => storage.removeItem(key)));
    throw error;
  }
  // Publish last: failed writes never replace the old snapshot.
  if (previous) {
    try {
      const old = JSON.parse(previous);
      if (isHead(old))
        await Promise.allSettled(
          Array.from({ length: old.parts }, (_, i) =>
            storage.removeItem(partKey(old, i)),
          ),
        );
    } catch {}
  }
}
