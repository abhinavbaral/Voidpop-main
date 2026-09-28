// Voidation website — Vite config.
//
// `npm run demo` / `npm run build:demo` (mode "demo") swap the on-device
// storage and the AniList client for the versions in shared/demo, so the site
// runs offline on a sample library. Same mechanism as app/metro.config.js.
import { defineConfig, normalizePath } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const shared = normalizePath(path.resolve(here, "../shared"));

function demoMode() {
  const demo = (f) => `${shared}/demo/${f}`;
  const demoDir = `${shared}/demo/`;
  // matched on the RESOLVED file, so package and relative imports both swap
  const byFile = {
    [`${shared}/api/anilist.js`]: demo("api-anilist.js"),
    [`${shared}/backend/storage.js`]: demo("storage.js"),
  };
  return {
    name: "voidation-demo",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (importer && normalizePath(importer).startsWith(demoDir)) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved && byFile[normalizePath(resolved.id)]) return byFile[normalizePath(resolved.id)];
      return resolved;
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), mode === "demo" && demoMode()].filter(Boolean),
  resolve: { dedupe: ["react", "react-dom"] },
  server: { port: 5173, fs: { allow: [".."] } },
  // single-file preview build: inline every asset so one HTML file is enough
  build: process.env.VITE_ROUTER === "memory" ? { assetsInlineLimit: 1e8, cssCodeSplit: false } : {},
}));
