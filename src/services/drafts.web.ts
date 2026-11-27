export type DraftMap = Record<string, unknown>;
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("qingri-drafts", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("drafts");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function loadDrafts(): Promise<DraftMap> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("drafts").objectStore("drafts").get("current");
      r.onsuccess = () => resolve(r.result || {});
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function persistDrafts(drafts: DraftMap): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite");
      tx.objectStore("drafts").put(drafts, "current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
