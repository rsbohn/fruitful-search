export type StorageBackend = "opfs" | "indexeddb" | "none";

const DB_NAME = "fruitful-search";
const STORE_NAME = "files";
const CATALOG_FILE = "catalog.json";
const EMBEDDINGS_FILE = "embeddings.json";

const hasOpfs = () =>
  typeof navigator !== "undefined" &&
  "storage" in navigator &&
  typeof navigator.storage.getDirectory === "function";

const hasIndexedDb = () =>
  typeof indexedDB !== "undefined" && indexedDB !== null;

const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "name" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const readFromIndexedDb = async (name: string): Promise<string | null> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(name);
    request.onsuccess = () => {
      const result = request.result as { name: string; text: string } | undefined;
      resolve(result?.text ?? null);
    };
    request.onerror = () => reject(request.error);
  });
};

const writeToIndexedDb = async (name: string, text: string): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ name, text });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const readFromOpfs = async (name: string): Promise<string | null> => {
  const root = await navigator.storage.getDirectory();
  try {
    const handle = await root.getFileHandle(name);
    const file = await handle.getFile();
    return await file.text();
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return null;
    }
    throw error;
  }
};

const writeToOpfs = async (name: string, text: string): Promise<void> => {
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
};

export const loadCatalogText = async (): Promise<{
  text: string | null;
  backend: StorageBackend;
}> => {
  if (hasOpfs()) {
    const text = await readFromOpfs(CATALOG_FILE);
    return { text, backend: "opfs" };
  }
  if (hasIndexedDb()) {
    const text = await readFromIndexedDb(CATALOG_FILE);
    return { text, backend: "indexeddb" };
  }
  return { text: null, backend: "none" };
};

export const saveCatalogText = async (text: string): Promise<StorageBackend> => {
  if (hasOpfs()) {
    await writeToOpfs(CATALOG_FILE, text);
    return "opfs";
  }
  if (hasIndexedDb()) {
    await writeToIndexedDb(CATALOG_FILE, text);
    return "indexeddb";
  }
  return "none";
};

export const loadEmbeddingsText = async (): Promise<{
  text: string | null;
  backend: StorageBackend;
}> => {
  if (hasOpfs()) {
    const text = await readFromOpfs(EMBEDDINGS_FILE);
    return { text, backend: "opfs" };
  }
  if (hasIndexedDb()) {
    const text = await readFromIndexedDb(EMBEDDINGS_FILE);
    return { text, backend: "indexeddb" };
  }
  return { text: null, backend: "none" };
};

export const saveEmbeddingsText = async (
  text: string
): Promise<StorageBackend> => {
  if (hasOpfs()) {
    await writeToOpfs(EMBEDDINGS_FILE, text);
    return "opfs";
  }
  if (hasIndexedDb()) {
    await writeToIndexedDb(EMBEDDINGS_FILE, text);
    return "indexeddb";
  }
  return "none";
};
