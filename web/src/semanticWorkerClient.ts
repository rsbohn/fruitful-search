import SemanticIndexWorker from "./workers/semanticIndexWorker?worker";

export type SemanticIndexStats = {
  docsIndexed: number;
  dimension: number;
  buildMs: number;
};

type EmbeddingItem = { pid: number; embedding: number[] };

type WorkerRequest =
  | { id: number; type: "build"; items: EmbeddingItem[] }
  | { id: number; type: "query"; vector: number[]; limit?: number }
  | { id: number; type: "clear" };

type WorkerResponse =
  | { id: number; type: "build-complete"; stats: SemanticIndexStats }
  | { id: number; type: "query-result"; results: { pid: number; score: number }[] }
  | { id: number; type: "cleared" }
  | { id: number; type: "error"; message: string };

export const createSemanticWorker = () => {
  const worker = new SemanticIndexWorker();
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
    timeoutMs = 30000
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
    buildIndex: async (items: EmbeddingItem[]): Promise<SemanticIndexStats> => {
      const message = await send({ type: "build", items }, 60000);
      if (message.type !== "build-complete") {
        throw new Error("Unexpected response from semantic index worker.");
      }
      return message.stats;
    },
    query: async (vector: number[], limit?: number) => {
      const message = await send({ type: "query", vector, limit });
      if (message.type !== "query-result") {
        throw new Error("Unexpected response from semantic index worker.");
      }
      return message.results;
    },
    clear: async () => {
      const message = await send({ type: "clear" });
      if (message.type !== "cleared") {
        throw new Error("Unexpected response from semantic index worker.");
      }
    },
    terminate: () => worker.terminate(),
  };
};
