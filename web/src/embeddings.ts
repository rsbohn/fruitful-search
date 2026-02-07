export type EmbeddingItem = {
  pid: number;
  embedding: number[];
};

export type EmbeddingPayload = {
  model?: string;
  dimension: number;
  items: EmbeddingItem[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
};

const parseEmbeddingItem = (raw: Record<string, unknown>): EmbeddingItem => {
  const pid = asNumber(raw.pid);
  const embedding = Array.isArray(raw.embedding) ? raw.embedding : null;
  if (pid === null || !embedding) {
    throw new Error("Embedding item missing pid or embedding array");
  }
  const vector = embedding.map((value) => {
    const num = asNumber(value);
    if (num === null) {
      throw new Error("Embedding vector contains non-numeric values");
    }
    return num;
  });
  return { pid, embedding: vector };
};

export const parseEmbeddingsJson = (payload: unknown): EmbeddingPayload => {
  if (!isRecord(payload)) {
    throw new Error("Embeddings JSON must be an object");
  }
  const dimension = asNumber(payload.dimension);
  const itemsRaw = payload.items;
  if (dimension === null || !Array.isArray(itemsRaw)) {
    throw new Error("Embeddings JSON missing dimension or items");
  }
  if (dimension <= 0) {
    throw new Error("Embeddings dimension must be positive");
  }
  const items = itemsRaw.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Embeddings JSON includes non-object rows");
    }
    return parseEmbeddingItem(item);
  });
  if (items.length === 0) {
    throw new Error("Embeddings JSON contains no items");
  }
  for (const item of items) {
    if (item.embedding.length !== dimension) {
      throw new Error(
        `Embedding vector length ${item.embedding.length} does not match dimension ${dimension}`
      );
    }
  }
  const model = asString(payload.model);
  return { model, dimension, items };
};
