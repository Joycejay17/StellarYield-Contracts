import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // `@stellaryield/sdk` is linked from ../sdk (see package.json). It ships as ESM
  // in ../sdk/dist, so it is excluded from pre-bundling to keep edits to the SDK
  // picked up after a plain `npm run build` in that package.
  optimizeDeps: { exclude: ["@stellaryield/sdk"] },
  server: { port: 5173 },
});
