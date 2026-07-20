export interface EmbeddingPort {
  readonly modelId: string;
  readonly dimensions: number;
  embed(text: string): Promise<readonly number[]>;
}
