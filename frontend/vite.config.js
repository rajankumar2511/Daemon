import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
    process: {
      env: {},
    },
  },
  resolve: {
    alias: {
      events: "events/",
      util: "util/",
      stream: "stream-browserify",
      buffer: "buffer",
      process: "process/browser",
    },
  },
  optimizeDeps: {
    include: [
      "simple-peer",
      "events",
      "util",
      "buffer",
      "process",
    ],
  },
});
