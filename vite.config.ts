/// <reference types="vitest/config" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxyTarget = "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/auth": apiProxyTarget,
      "/dashboard": apiProxyTarget,
      "/habits": apiProxyTarget,
      "/logs": apiProxyTarget,
      "/onboarding": apiProxyTarget,
      "/settings": apiProxyTarget,
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**"],
  },
});
