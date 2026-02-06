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
  | { id: number; type: "query"; query: string; limit?: number }
  | { id: number; type: "clear" };

type WorkerResponse =
  | { id: number; type: "build-complete"; stats: LexicalIndexStats }
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
    { resolve: (value: WorkerResponse) => void; reject: (error: Error) => void }
  >();

  const rejectAll = (error: Error) => {
    for (const [, entry] of pending) {
      entry.reject(error);
    }
    pending.clear();
  };

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    const request = pending.get(message.id);
    if (!request) {
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
    timeoutMs = 15000
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
      pending.set(id, { resolve: wrappedResolve, reject: wrappedReject });
    });
  };

  return {
    buildIndex: async (catalog: CatalogProduct[]): Promise<LexicalIndexStats> => {
      const message = await send(
        { type: "build", catalog: toIndexItems(catalog) },
        30000
      );
      if (message.type !== "build-complete") {
        throw new Error("Unexpected response from lexical index worker.");
      }
      return message.stats;
    },
    query: async (query: string, limit?: number) => {
      const message = await send({ type: "query", query, limit });
      if (message.type !== "query-result") {
        throw new Error("Unexpected response from lexical index worker.");
      }
      return message.results;
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
