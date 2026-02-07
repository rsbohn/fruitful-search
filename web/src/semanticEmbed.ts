type EmbeddingResult = {
  vector: number[];
  dimension: number;
};

let pipelinePromise: Promise<unknown> | null = null;

export const embedQuery = async (
  text: string,
  model: string
): Promise<EmbeddingResult> => {
  if (!text.trim()) {
    return { vector: [], dimension: 0 };
  }
  const { pipeline, env } = await import("@xenova/transformers");
  env.allowRemoteModels = true;
  env.allowLocalModels = false;
  env.remoteModelPath = "https://huggingface.co/";
  env.useBrowserCache = true;
  if (!pipelinePromise) {
    pipelinePromise = pipeline("feature-extraction", model);
  }
  const extractor = (await pipelinePromise) as {
    (input: string, options?: Record<string, unknown>): Promise<{
      data: Float32Array | number[];
      dims: number[];
    }>;
  };
  const output = await extractor(text, { pooling: "mean", normalize: true });
  const data = Array.from(output.data as Float32Array);
  const dimension = output.dims[output.dims.length - 1] ?? data.length;
  return { vector: data, dimension };
};
