type EmbeddingItem = {
  pid: number;
  embedding: number[];
};

type WorkerRequest =
  | { id: number; type: "build"; items: EmbeddingItem[] }
  | { id: number; type: "query"; vector: number[]; limit?: number }
  | { id: number; type: "clear" };

type WorkerResponse =
  | {
      id: number;
      type: "build-complete";
      stats: { docsIndexed: number; dimension: number; buildMs: number };
    }
  | { id: number; type: "query-result"; results: { pid: number; score: number }[] }
  | { id: number; type: "cleared" }
  | { id: number; type: "error"; message: string };

let dimension = 0;
let docCount = 0;
let pids: Int32Array | null = null;
let vectors: Float32Array | null = null;

const normalizeInPlace = (vec: Float32Array) => {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i += 1) {
    const v = vec[i];
    sumSq += v * v;
  }
  if (sumSq <= 0) {
    return;
  }
  const inv = 1 / Math.sqrt(sumSq);
  for (let i = 0; i < vec.length; i += 1) {
    vec[i] *= inv;
  }
};

const buildIndex = (items: EmbeddingItem[]) => {
  const start = performance.now();
  if (items.length === 0) {
    dimension = 0;
    docCount = 0;
    pids = null;
    vectors = null;
    return { docsIndexed: 0, dimension: 0, buildMs: performance.now() - start };
  }
  dimension = items[0].embedding.length;
  docCount = items.length;
  pids = new Int32Array(docCount);
  vectors = new Float32Array(docCount * dimension);

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.embedding.length !== dimension) {
      throw new Error("Embedding dimension mismatch.");
    }
    pids[i] = item.pid;
    const offset = i * dimension;
    for (let j = 0; j < dimension; j += 1) {
      vectors[offset + j] = item.embedding[j];
    }
    const slice = vectors.subarray(offset, offset + dimension);
    normalizeInPlace(slice);
  }

  const end = performance.now();
  return { docsIndexed: docCount, dimension, buildMs: end - start };
};

const queryIndex = (queryVector: number[], limit = 50) => {
  if (!vectors || !pids || docCount === 0 || dimension === 0) {
    return [] as { pid: number; score: number }[];
  }
  if (queryVector.length !== dimension) {
    throw new Error(
      `Query dimension ${queryVector.length} does not match index dimension ${dimension}`
    );
  }
  const q = new Float32Array(queryVector);
  normalizeInPlace(q);
  const scores: { pid: number; score: number }[] = [];
  for (let i = 0; i < docCount; i += 1) {
    let dot = 0;
    const offset = i * dimension;
    for (let j = 0; j < dimension; j += 1) {
      dot += q[j] * vectors[offset + j];
    }
    scores.push({ pid: pids[i], score: dot });
  }
  return scores.sort((a, b) => b.score - a.score).slice(0, limit);
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    if (message.type === "build") {
      const stats = buildIndex(message.items);
      const response: WorkerResponse = {
        id: message.id,
        type: "build-complete",
        stats,
      };
      self.postMessage(response);
      return;
    }
    if (message.type === "query") {
      const results = queryIndex(message.vector, message.limit);
      const response: WorkerResponse = {
        id: message.id,
        type: "query-result",
        results,
      };
      self.postMessage(response);
      return;
    }
    if (message.type === "clear") {
      dimension = 0;
      docCount = 0;
      pids = null;
      vectors = null;
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
