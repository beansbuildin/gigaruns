import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-time proxy to the local backend (web/server, default port 4173) so the
// browser only ever talks to one origin. Both sides bind to 127.0.0.1 only —
// see web/server/src/index.ts's doc comment for why that's not negotiable.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4173",
        changeOrigin: false,
      },
    },
  },
});
