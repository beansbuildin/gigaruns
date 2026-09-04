/**
 * web/server/src/routes/jwt.ts — read and save a profile's JWT.
 *
 * The local expiry check mirrors `scripts/doctor.ts`'s own — decode the
 * `exp` claim without a network call, on purpose (a network round-trip
 * cannot distinguish "expired" from "malformed" from "revoked", and the
 * claim is right there in the token; see doctor.ts's doc comment). Kept as
 * a second, small copy here rather than exported from doctor.ts, because
 * doctor.ts is a `main()`-shaped CLI script, not a module built to be
 * imported — same reasoning `parentRepo.ts` gives for not reaching into the
 * strategy/sim graph.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { Router } from "express";

import { mask, resolveProfile } from "../parentRepo.js";

const router = Router();

function jwtExpiry(jwt: string): { exp: number | null; malformed: boolean } {
  const parts = jwt.split(".");
  if (parts.length !== 3) return { exp: null, malformed: true };
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as { exp?: unknown };
    return { exp: typeof payload.exp === "number" ? payload.exp : null, malformed: false };
  } catch {
    return { exp: null, malformed: true };
  }
}

router.get("/:name/jwt", (req, res) => {
  let profile;
  try {
    profile = resolveProfile(req.params.name);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
    return;
  }

  if (!existsSync(profile.jwtPath)) {
    res.json({ present: false, path: profile.jwtPath });
    return;
  }
  const raw = readFileSync(profile.jwtPath, "utf8").trim();
  if (!raw) {
    res.json({ present: false, path: profile.jwtPath });
    return;
  }
  const { exp, malformed } = jwtExpiry(raw);
  if (malformed) {
    res.json({ present: true, malformed: true, path: profile.jwtPath });
    return;
  }
  const secondsLeft = exp === null ? null : exp - Math.floor(Date.now() / 1000);
  res.json({
    present: true,
    malformed: false,
    masked: mask(raw),
    path: profile.jwtPath,
    exp,
    secondsLeft,
    expired: secondsLeft !== null && secondsLeft <= 0,
  });
});

router.post("/:name/jwt", (req, res) => {
  let profile;
  try {
    profile = resolveProfile(req.params.name);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
    return;
  }

  const token = String((req.body as { token?: unknown } | undefined)?.token ?? "").trim();
  if (!token) {
    res.status(400).json({ error: "No token provided." });
    return;
  }
  if (token.toLowerCase().startsWith("bearer ")) {
    res.status(400).json({ error: 'Store the token only — remove the leading "Bearer ".' });
    return;
  }
  if (token.split(".").length !== 3) {
    res.status(400).json({ error: "Doesn't look like a JWT (expected three dot-separated parts)." });
    return;
  }

  mkdirSync(dirname(profile.jwtPath), { recursive: true });
  // 0o600: this is a session credential, same file the CLI already reads —
  // no group/other access, matching the trust boundary the README describes.
  writeFileSync(profile.jwtPath, token, { mode: 0o600 });
  res.json({ ok: true, path: profile.jwtPath });
});

export default router;
