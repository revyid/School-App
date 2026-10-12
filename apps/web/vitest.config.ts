import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": dirname },
  },
  test: {
    include: ["server/__tests__/**/*.test.ts", "lib/__tests__/**/*.test.ts", "lib/__tests__/**/*.test.tsx"],
    environment: "node",
  },
});
