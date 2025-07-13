import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    rollupOptions: {
      input: "./index.html",
    },
  },
  resolve: {
    alias: {
      "@plugin": path.resolve(__dirname, "../plugin/src"), // adjust path as needed
    },
  },
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
});
