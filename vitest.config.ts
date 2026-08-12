import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // Strategy and sim code is pure — nothing here should ever open a socket.
    // If a test hangs, it is reaching for the network and that is a bug.
    testTimeout: 10_000,
  },
});
