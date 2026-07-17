import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/validation.ts"],
      thresholds: {
        statements: 100,
        branches: 75,
        functions: 100,
        lines: 100,
      },
    },
  },
});
