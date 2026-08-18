import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/qixi-0523-echo-core/",
  root: "github-pages",
  publicDir: "../public",
  plugins: [react()],
  build: {
    outDir: "../dist-github-pages",
    emptyOutDir: true,
  },
});
