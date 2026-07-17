import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/application/**/*.ts",
        "src/domain/**/*.ts",
        "src/modules/**/*.ts",
      ],
      exclude: ["src/application/repositories.ts"],
      thresholds: {
        statements: 95,
        branches: 85,
        functions: 100,
        lines: 95,
      },
    },
  },
});
