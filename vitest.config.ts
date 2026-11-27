import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: [{ find: /^react-native$/, replacement: "react-native-web" }],
    extensions: [
      ".web.tsx",
      ".web.ts",
      ".web.js",
      ".tsx",
      ".ts",
      ".js",
      ".jsx",
      ".json",
    ],
  },
  test: {
    environment: "jsdom",
    include: ["tests/*.ui.test.tsx", "tests/*.integration.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20000,
  },
});
