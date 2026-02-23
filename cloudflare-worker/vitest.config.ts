import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.d.ts", "**/node_modules/**"],
      thresholds: {
        lines: 65,
        functions: 70,
        branches: 50,
        statements: 60,
      },
    },
  },
});
