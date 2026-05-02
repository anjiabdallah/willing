export const runEmbeddingInBackground = (label: string, job: () => Promise<unknown>) => {
  void job().catch((error: unknown) => {
    console.error(`[embeddings] Background job failed: ${label}`, error);
  });
};
