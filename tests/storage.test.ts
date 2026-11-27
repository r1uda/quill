import { test } from "node:test";
import assert from "node:assert/strict";
import { readSnapshot, writeSnapshot, DATA_KEY } from "../src/domain/snapshot";
function memoryStore() {
  const map = new Map<string, string>();
  return {
    map,
    async getItem(k: string) {
      return map.get(k) || null;
    },
    async setItem(k: string, v: string) {
      map.set(k, v);
    },
    async removeItem(k: string) {
      map.delete(k);
    },
  };
}
test("large backgrounds round-trip without large per-entry writes", async () => {
  const s = memoryStore();
  const value = JSON.stringify({
    background: "a".repeat(2500000),
    title: "生日",
  });
  await writeSnapshot(s, value);
  assert.equal(await readSnapshot(s), value);
  assert.ok([...s.map.values()].every((v) => v.length <= 120000));
});
test("a failed write leaves the previously committed calendar intact", async () => {
  const s = memoryStore();
  await writeSnapshot(s, JSON.stringify({ title: "原本的安排" }));
  const old = await readSnapshot(s);
  const setter = s.setItem;
  let writes = 0;
  s.setItem = async (k, v) => {
    if (++writes === 2) throw new Error("disk full");
    return setter(k, v);
  };
  await assert.rejects(() => writeSnapshot(s, "x".repeat(500000)));
  assert.equal(await readSnapshot(s), old);
});
test("missing chunks produce a recovery error rather than empty data", async () => {
  const s = memoryStore();
  await writeSnapshot(s, "abc");
  const head = JSON.parse(s.map.get(DATA_KEY)!);
  s.map.delete(`${DATA_KEY}:${head.generation}:0`);
  await assert.rejects(() => readSnapshot(s), /缺失/);
});
test("previous one-file snapshot is readable and migrates on write", async () => {
  const s = memoryStore();
  s.map.set(DATA_KEY, '{"legacy":true}');
  assert.equal(await readSnapshot(s), '{"legacy":true}');
  await writeSnapshot(s, '{"version":1}');
  assert.equal(await readSnapshot(s), '{"version":1}');
});
test("emoji at chunk boundaries survives UTF-8 storage", async () => {
  const s = memoryStore();
  const original = s.setItem;
  s.setItem = async (k, v) =>
    original(k, new TextDecoder().decode(new TextEncoder().encode(v)));
  const value = "x".repeat(119999) + "🎂生日";
  await writeSnapshot(s, value);
  assert.equal(await readSnapshot(s), value);
});
