# session 53 — surprises

## S1. Brief §0a VERIFIED — session 52's "server changed" is refuted
`post_attempt_failed` counts with `reason: "reward selection rejected"`:
08-18: 12+10+10+8 = 40 (of 40 decisions). 08-20: 14+2+10 = 26 (of 26).
100% on both sides. `reason` predates the `serverErrorDetail` fix; only
`body`/`message` are new. Session 52 grepped for "Invalid action token"
— a string that could not exist before 08-19 — and read newly-visible as new.

## S2. The brief's 3600ms is on the WRONG CLOCK and would likely have FAILED the gate
The brief measured the split as "gap to the preceding response":
  rejected 0.90–1.54s (n=66) / accepted 3.40–4.92s (n=66) — reproduced EXACTLY.
But `RateLimiter.wait()` stamps `lastCallAt` BEFORE dispatch, so `minGapMs`
is a REQUEST-to-REQUEST gap. The two differ by one response latency:
  since_last_response = requestGap - latency,  latency 0.72–1.78s (med 1.45, n=296).
So minGapMs=3600 yields since_last_response ≈ 1.82s worst case / 2.15s typical
— inside the UNMEASURED zone (1.54, 3.40), only 280ms above the highest
observed REJECTION. Not a safe setting.
FIX: put the override on the clock the measurement lives on —
`minGapSinceResponseMs`, set to 4000ms, squarely inside the proven-success
band [3.40, 4.92] (median 4.07) and immune to latency variation.
This is a unit correction found BEFORE the run, not "raising the number
until it passes" (which the brief rightly forbids).

## S3. The action-token epoch cannot be used as an absolute clock — local clock skew
`token_epoch - dispatch_ts` = 0.70–2.68s (median 1.93s), LARGER than the full
POST→response round trip (median 1.45s). The server clock is ahead of this
machine by roughly 1.5–2s. Relative comparisons within a session are fine;
absolute "elapsed since token issued" is not. All timing conclusions here are
therefore anchored on LOCAL response timestamps only.
