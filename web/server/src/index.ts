/**
 * web/server/src/index.ts — the Giga bot's local web UI backend.
 *
 * Binds to 127.0.0.1 ONLY, deliberately and without a flag to change it.
 * The root README's "Not planned" section says this project will never
 * become a hosted service or hold anyone else's token; a local-only server
 * that a user runs on their own machine, reading their own already-local
 * JWT file, doesn't change that — it's the same trust boundary the CLI
 * scripts already have. Binding wider than localhost would.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import express from "express";

import configRouter from "./routes/config.js";
import jobsRouter from "./routes/jobs.js";
import jwtRouter from "./routes/jwt.js";
import profilesRouter from "./routes/profiles.js";
import { REPO_ROOT } from "./repoRoot.js";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT ?? 4173);

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, repoRoot: REPO_ROOT });
});

app.use("/api/profiles", profilesRouter);
app.use("/api/profiles", jwtRouter);
app.use("/api/profiles", configRouter);
app.use("/api/jobs", jobsRouter);

// If the client has been built (`cd web/client && npm run build`), serve it
// directly so the whole thing is one `npm start` away from working. In dev,
// run `npm run dev` in web/client instead and hit its own Vite server.
const clientDist = join(REPO_ROOT, "web", "client", "dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(join(clientDist, "index.html"));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`\n▸ Giga web UI — http://${HOST}:${PORT}\n`);
  console.log(`  Bound to localhost only — nothing here is reachable from the network.`);
  if (!existsSync(clientDist)) {
    console.log(`  No built client found at web/client/dist — run the frontend's own dev`);
    console.log(`  server separately: cd web/client && npm install && npm run dev\n`);
  }
});
