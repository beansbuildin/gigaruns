# scratch — session 58 surprises

## 1. I invented an energy blocker. The repo already solved it.
Read `GET /offchain/player/energy` -> `energyValue: 11` and wrote both live
items off as blocked for ~13h. **User directive (mid-session, with visible
frustration at repeating it): energy is NEVER a constraint — the account makes
~1368/day once the ROMs NFTs are counted, and that endpoint reports only the
passive regen pool.** Recorded in DECISIONS 2026-08-20.

Worse: `scripts/liveRun.ts` has had an **energy preflight** all along. The
dry-run printed it unprompted —
```
▸ energy preflight: pool 17 short of the planned 60 (deficit 43) — reading the ROM bank.
▸ ROM bank: 37 ROMs, 25 with energyCollectable > 0, 2251 energy claimable
▸ [read-only] would claim 1 ROM(s) for a snapshot total of 315/43
```
So the number I was alarmed by is one the loop handles by claiming a ROM. The
lesson is narrower than "don't cite energy": **before reporting a blocker,
exercise the real gate** (`--dry-run` here) instead of reasoning from a raw
endpoint reading. The dry run is free and would have told me in 20 seconds.

## 2. The real cap is server-side runs, and it is not derivable from energy
`real server runs today: 12/12 — any start_run will be rejected server-side`,
`maxRunsPerDay: 12` in discovered.json. Rule 11's "240 energy / 60 = 4 juiced
runs" derivation is now DEAD — 1368/60 = 22.8. The 12 run-units / 3 = 4 arm is
the only live one. **Rule 11 says "if those two numbers ever disagree, stop —
something has been edited without the other." They now disagree permanently,
and nothing was edited. The rule needs its energy half removed.**

## 3. An offer's room is ROOM_NUM_CID - 1 (135/135)
Found while joining payouts onto the sim's offer table. `orbTieBreakReport.ts`
shipped in session 57 reading the raw wire value. Corrected; A/B/C totals came
back identical to the orb, so §24's numbers stood — inert here, would not stay
inert deeper (room feeds the rooms-1..8 lifesteal window and rankBoons'
roomsRemaining).

## 4. 17 of 135 OBSERVED_OFFERS rows have a `source` two states past the offer
Uniform -2, five runs, and they are the corpus's DEEPEST offers (rooms 6-9). A
source-keyed join drops exactly the rows a depth experiment wants. Joined on
room+content instead -> 135/135.

## 5. A null needs an open CHANNEL, not just precision
The brief's threshold-vs-detection argument was right but incomplete. `applyBoon`
moves state for only SIX boon types; `rolled` writes a stat combat.ts never
reads, `latent` is `case "latent": break;`, unmodelled returns unchanged. Two
arms differing only on inert options are bit-identical, so a 0.00 would have
been guaranteed rather than earned. Checked as stage 0: channel open (25.8% of
differences touch a state-moving option, 21.1% of seeds diverged).

## 6. The paired statistic did the work
78.9% of seeds produce an IDENTICAL run in both arms. An unpaired CI throws that
agreement away as noise: unpaired half-width 0.0286 vs paired 0.0155.
