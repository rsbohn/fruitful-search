import { CatalogProduct } from "./catalog";
import LexicalIndexWorker from "./workers/lexicalIndexWorker?worker";

type CatalogIndexItem = {
  product_id: number;
  product_name?: string;
  product_model?: string;
  product_mpn?: string;
  product_manufacturer?: string;
  product_image_alt?: string;
};

export type LexicalIndexStats = {
  docsIndexed: number;
  uniqueTokens: number;
  avgTokensPerDoc: number;
  buildMs: number;
};

type WorkerRequest =
  | { id: number; type: "build"; catalog: CatalogIndexItem[] }
  | { id: number; type: "build-init"; total: number }
  | { id: number; type: "build-chunk"; catalog: CatalogIndexItem[] }
  | { id: number; type: "build-finish" }
  | { id: number; type: "ping" }
  | { id: number; type: "query"; query: string; limit?: number }
  | { id: number; type: "clear" };

type WorkerResponse =
  | { id: number; type: "build-complete"; stats: LexicalIndexStats }
  | { id: number; type: "build-progress"; processed: number; total: number }
  | { id: number; type: "build-ack" }
  | { id: number; type: "pong" }
  | { id: number; type: "log"; message: string }
  | { id: number; type: "query-result"; results: { pid: number; score: number }[] }
  | { id: number; type: "cleared" }
  | { id: number; type: "error"; message: string };

const toIndexItems = (catalog: CatalogProduct[]): CatalogIndexItem[] =>
  catalog.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    product_model: item.product_model,
    product_mpn: item.product_mpn,
    product_manufacturer: item.product_manufacturer,
    product_image_alt: item.product_image_alt,
  }));

export const createLexicalWorker = () => {
  const worker = new LexicalIndexWorker();
  let nextId = 1;
  const pending = new Map<
    number,
    {
      resolve: (value: WorkerResponse) => void;
      reject: (error: Error) => void;
      onProgress?: (processed: number, total: number) => void;
    }
  >();

  const rejectAll = (error: Error) => {
    for (const [, entry] of pending) {
      entry.reject(error);
    }
    pending.clear();
  };

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (message.type === "log") {
      console.log(message.message);
      return;
    }
    const request = pending.get(message.id);
    if (!request) {
      return;
    }
    if (message.type === "build-progress") {
      request.onProgress?.(message.processed, message.total);
      return;
    }
    pending.delete(message.id);
    if (message.type === "error") {
      request.reject(new Error(message.message));
    } else {
      request.resolve(message);
    }
  };

  worker.onerror = (event) => {
    const message = event.message || "Worker error.";
    rejectAll(new Error(message));
  };

  worker.onmessageerror = () => {
    rejectAll(new Error("Worker message error."));
  };

  const send = (
    payload: Omit<WorkerRequest, "id">,
    timeoutMs = 15000,
    onProgress?: (processed: number, total: number) => void
  ): Promise<WorkerResponse> => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      worker.postMessage({ id, ...payload });
      const timer = window.setTimeout(() => {
        if (!pending.has(id)) {
          return;
        }
        pending.delete(id);
        reject(new Error("Worker timed out."));
      }, timeoutMs);
      const wrappedResolve = (value: WorkerResponse) => {
        window.clearTimeout(timer);
        resolve(value);
      };
      const wrappedReject = (error: Error) => {
        window.clearTimeout(timer);
        reject(error);
      };
      pending.set(id, { resolve: wrappedResolve, reject: wrappedReject, onProgress });
    });
  };

  return {
    buildIndex: async (
      catalog: CatalogProduct[],
      onProgress?: (processed: number, total: number) => void
    ): Promise<LexicalIndexStats> => {
      const items = toIndexItems(catalog);
      const total = items.length;
      const init = await send({ type: "build-init", total }, 15000, onProgress);
      if (init.type !== "build-ack") {
        throw new Error("Unexpected response from lexical index worker.");
      }
      const chunkSize = 400;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const ack = await send(
          { type: "build-chunk", catalog: chunk },
          30000,
          onProgress
        );
        if (ack.type !== "build-ack") {
          throw new Error("Unexpected response from lexical index worker.");
        }
      }
      const done = await send({ type: "build-finish" }, 30000, onProgress);
      if (done.type !== "build-complete") {
        throw new Error("Unexpected response from lexical index worker.");
      }
      return done.stats;
    },
    query: async (query: string, limit?: number) => {
      const message = await send({ type: "query", query, limit });
      if (message.type !== "query-result") {
        throw new Error("Unexpected response from lexical index worker.");
      }
      return message.results;
    },
    ping: async (timeoutMs = 2000) => {
      const message = await send({ type: "ping" }, timeoutMs);
      if (message.type !== "pong") {
        throw new Error("Unexpected response from lexical index worker.");
      }
    },
    clear: async () => {
      const message = await send({ type: "clear" });
      if (message.type !== "cleared") {
        throw new Error("Unexpected response from lexical index worker.");
      }
    },
    terminate: () => worker.terminate(),
  };
};
