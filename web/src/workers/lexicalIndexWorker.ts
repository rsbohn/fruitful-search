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

const buildIndex = (catalog: CatalogIndexItem[]) => {
  const start = performance.now();
  invertedIndex = new Map();
  docCount = 0;
  totalTokens = 0;

  for (const item of catalog) {
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
      continue;
    }

    const tokens = tokenize(text);
    if (tokens.length === 0) {
      continue;
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
  }

  const end = performance.now();
  return {
    docsIndexed: docCount,
    uniqueTokens: invertedIndex.size,
    avgTokensPerDoc: docCount === 0 ? 0 : totalTokens / docCount,
    buildMs: end - start,
  };
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
    if (message.type === "build") {
      const stats = buildIndex(message.catalog);
      const response: WorkerResponse = {
        id: message.id,
        type: "build-complete",
        stats,
      };
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
      invertedIndex = new Map();
      docCount = 0;
      totalTokens = 0;
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
