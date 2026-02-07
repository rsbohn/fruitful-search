type CatalogIndexItem = {
  product_id: number;
  product_name?: string;
  product_model?: string;
  product_mpn?: string;
  product_manufacturer?: string;
  product_image_alt?: string;
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
  | {
      id: number;
      type: "build-complete";
      stats: {
        docsIndexed: number;
        uniqueTokens: number;
        avgTokensPerDoc: number;
        buildMs: number;
      };
    }
  | {
      id: number;
      type: "build-progress";
      processed: number;
      total: number;
    }
  | { id: number; type: "build-ack" }
  | { id: number; type: "pong" }
  | {
      id: number;
      type: "log";
      message: string;
    }
  | { id: number; type: "query-result"; results: { pid: number; score: number }[] }
  | { id: number; type: "cleared" }
  | { id: number; type: "error"; message: string };

const tokenPattern = /[^a-z0-9]+/g;

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(tokenPattern)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

let invertedIndex = new Map<string, Map<number, number>>();
let docCount = 0;
let totalTokens = 0;
let buildTotal = 0;
let buildProcessed = 0;
let buildStart = 0;

const emitLog = (_id: number, _message: string) => {
  // Intentionally no-op: logging disabled.
};

const resetBuildState = () => {
  invertedIndex = new Map();
  docCount = 0;
  totalTokens = 0;
  buildTotal = 0;
  buildProcessed = 0;
  buildStart = 0;
};

const emitProgress = (id: number) => {
  const response: WorkerResponse = {
    id,
    type: "build-progress",
    processed: buildProcessed,
    total: buildTotal,
  };
  self.postMessage(response);
};

const processItem = (item: CatalogIndexItem) => {
  const text = [
    item.product_name,
    item.product_model,
    item.product_mpn,
    item.product_manufacturer,
    item.product_image_alt,
  ]
    .filter(Boolean)
    .join(" ");

  if (!text) {
    return;
  }

  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return;
  }
  docCount += 1;
  const perDoc = new Map<string, number>();
  for (const token of tokens) {
    perDoc.set(token, (perDoc.get(token) ?? 0) + 1);
  }
  totalTokens += perDoc.size;

  for (const [token, count] of perDoc) {
    let posting = invertedIndex.get(token);
    if (!posting) {
      posting = new Map();
      invertedIndex.set(token, posting);
    }
    posting.set(item.product_id, count);
  }
};

const buildIndex = async (catalog: CatalogIndexItem[], id: number) => {
  resetBuildState();
  const start = performance.now();
  buildStart = start;
  buildTotal = catalog.length;
  emitLog(
    id,
    `[lexical-worker] build start docs=${buildTotal} request=${id}`
  );

  for (let i = 0; i < catalog.length; i += 1) {
    processItem(catalog[i]);
    buildProcessed += 1;

    if (i % 200 === 0 || i === catalog.length - 1) {
      emitProgress(id);
      // Progress logs intentionally suppressed (start/done only).
      if (i % 200 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  const end = performance.now();
  const stats = {
    docsIndexed: docCount,
    uniqueTokens: invertedIndex.size,
    avgTokensPerDoc: docCount === 0 ? 0 : totalTokens / docCount,
    buildMs: end - start,
  };
  emitLog(
    id,
    `[lexical-worker] build complete docs=${stats.docsIndexed} tokens=${stats.uniqueTokens} ms=${Math.round(
      stats.buildMs
    )} request=${id}`
  );
  return stats;
};

const startChunkedBuild = (total: number, id: number) => {
  resetBuildState();
  buildStart = performance.now();
  buildTotal = total;
  emitLog(id, `[lexical-worker] build init total=${total} request=${id}`);
  emitProgress(id);
};

const addChunk = async (catalog: CatalogIndexItem[], id: number) => {
  for (let i = 0; i < catalog.length; i += 1) {
    processItem(catalog[i]);
    buildProcessed += 1;
    if (buildProcessed % 200 === 0 || buildProcessed === buildTotal) {
      emitProgress(id);
      // Progress logs intentionally suppressed (start/done only).
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
};

const finishChunkedBuild = (id: number) => {
  const end = performance.now();
  const stats = {
    docsIndexed: docCount,
    uniqueTokens: invertedIndex.size,
    avgTokensPerDoc: docCount === 0 ? 0 : totalTokens / docCount,
    buildMs: end - buildStart,
  };
  emitLog(
    id,
    `[lexical-worker] build complete docs=${stats.docsIndexed} tokens=${stats.uniqueTokens} ms=${Math.round(
      stats.buildMs
    )} request=${id}`
  );
  return stats;
};

const queryIndex = (query: string, limit = 50) => {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return [] as { pid: number; score: number }[];
  }
  const scores = new Map<number, number>();
  for (const token of tokens) {
    const posting = invertedIndex.get(token);
    if (!posting) {
      continue;
    }
    for (const [pid, count] of posting) {
      scores.set(pid, (scores.get(pid) ?? 0) + count);
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([pid, score]) => ({ pid, score }));
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    // Avoid noisy per-message logs. Use start/done only.
    if (message.type === "build") {
      buildIndex(message.catalog, message.id)
        .then((stats) => {
          const response: WorkerResponse = {
            id: message.id,
            type: "build-complete",
            stats,
          };
          self.postMessage(response);
        })
        .catch((error) => {
          const response: WorkerResponse = {
            id: message.id,
            type: "error",
            message: error instanceof Error ? error.message : "Worker error.",
          };
          self.postMessage(response);
        });
      return;
    }
    if (message.type === "build-init") {
      startChunkedBuild(message.total, message.id);
      const response: WorkerResponse = { id: message.id, type: "build-ack" };
      self.postMessage(response);
      return;
    }
    if (message.type === "build-chunk") {
      addChunk(message.catalog, message.id)
        .then(() => {
          const response: WorkerResponse = { id: message.id, type: "build-ack" };
          self.postMessage(response);
        })
        .catch((error) => {
          const response: WorkerResponse = {
            id: message.id,
            type: "error",
            message: error instanceof Error ? error.message : "Worker error.",
          };
          self.postMessage(response);
        });
      return;
    }
    if (message.type === "build-finish") {
      const stats = finishChunkedBuild(message.id);
      const response: WorkerResponse = {
        id: message.id,
        type: "build-complete",
        stats,
      };
      self.postMessage(response);
      return;
    }
    if (message.type === "ping") {
      const response: WorkerResponse = { id: message.id, type: "pong" };
      self.postMessage(response);
      return;
    }
    if (message.type === "query") {
      const results = queryIndex(message.query, message.limit);
      const response: WorkerResponse = {
        id: message.id,
        type: "query-result",
        results,
      };
      self.postMessage(response);
      return;
    }
    if (message.type === "clear") {
      resetBuildState();
      const response: WorkerResponse = { id: message.id, type: "cleared" };
      self.postMessage(response);
      return;
    }
    const response: WorkerResponse = {
      id: message.id,
      type: "error",
      message: "Unknown request type.",
    };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id: message.id,
      type: "error",
      message: error instanceof Error ? error.message : "Worker error.",
    };
    self.postMessage(response);
  }
};
