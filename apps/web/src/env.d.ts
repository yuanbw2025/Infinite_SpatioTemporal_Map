/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SEMANTIC_EMBEDDING_ENDPOINT?: string;
  readonly VITE_SEMANTIC_MODEL_ID?: string;
  readonly VITE_SEMANTIC_DIMENSIONS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
