# Session 126 — 2026-09-09 — day 20704 (dow 5, CHOBO) — dungeon GATE PASS, fishing/tripwire GATE FAIL

Full detail behind `handoff/STATE.md`. Pre-registration: `6e3fa22e`.

---

## 0. The three-line restatement, and what changed within twenty minutes

Task: spend the day on both arms per the session-126 brief. Gate: the Dendren
catch-rate tripwire at n ≈ 100, plus per-run go-aheads. First action: live
reads, then pre-register.

**The brief was written at 17:11Z and the session opened at 17:14Z. In those
three minutes nothing changed — but the brief had already been overtaken by
the CLOCK**, which it flagged itself and then reasoned past.

---

## 1. Step 0 — the JWT, recorded as a number (the brief's third consecutive ask)

`npx tsx scripts/doctor.ts`, 17:15Z:

```
  ✓ token present and valid for another 71.4h
  ✓ config valid — dungeon 5, 20 energy/run, budget 240/day, 12 runs
  today's local ledgers (roll over at 11:00 Pacific, 0.8h from now):
    dungeon: 0 runs / 0 energy recorded
    fishing: 0 casts / 0 energy recorded
```

**Expiry ≈ 2026-09-12T16:40Z.** This matches the brief's projection from session
125's measurement exactly, which is worth noting: the projection was sound, and
the instruction to verify rather than quote it cost one command and confirmed it.

---

## 2. Step 1 — the live reads, and the six claims

Game day **20704**, week 87, **dayOfWeek 5 → Chobo (134)**, `next day in
00:44:24`.

| # | Brief | Live | |
|---|---|---|---|
| A | 20705 / dow 6 / Athena, **or 20704 / dow 5 / Chobo if before 18:00Z** | 20704, dow 5, Chobo | **PASS** (alternate branch) |
| B | rings 207 total; Athena 21, Archon 24, Crusader 27, Chobo 30, Summoner 30, Foxglove 33, Overseer 42 | identical, sum 207 | **PASS** |
| C | run-units 0/12 | `dayProgressEntities` null | **PASS** |
| D | fishing 0/20 charged | `dayDocs[2]` 0/20 | **PASS** |
| E | rod 923 = 6; slot-15 pair = 1 and 6 | rod 6; pair **20 / 20** | **FAIL** |
| F | 901 = 5; 641 = 12; 905 = 12; 640 = 34 | **901 = 26**; rest exact | **FAIL** |

**Both failures are out-of-band user repairs — the second consecutive session
with that exact failure mode, which the brief predicted.** The check working,
not a defect.

### The consequence the brief got backwards

The brief's headline was "NEITHER ARM CAN DELIVER THE REQUESTED DAY". After the
repairs, that was true of exactly one arm, and it was the other one:

- **Dungeon: a full 4-run day needed NO repair.** 641 and 905 at 12 each land on
  exactly 0 at the end of run 4, so the gear halt coincides with the 12/12 cap
  and costs nothing.
- **Fishing: the rod at 6 was the SOLE binding piece** — the slot-15 pair had
  been repaired to 20/20 and no longer bound first. Six played casts, not 30.

Both were put to the user in one message, up front, before any spend.

---

## 3. ⭐ The timing finding — it was a CHOBO day, and that is worth 12 Athena

The brief warned this would be an Athena day and that Athena, at 21, was the
first faction to fall below a full day's cost. **`checkEntryTiers.ts` said
otherwise**: 44 minutes of day 20704 remained, and day 20704 is dow 5 → Chobo,
which held **30**.

Put to the user before the first go-ahead, with the arithmetic:

- four runs starting before 18:00Z → **Chobo 30 → 18**, Athena untouched at 21;
- four runs after → **Athena 21 → 9**.

The user chose to start immediately. All four runs completed before the
rollover. **Athena closed at 21, untouched.**

**The general lesson, which is the durable half:** a faction is a function of
the rollover clock, and a brief written hours before a session will name the
wrong one whenever it straddles 18:00Z. `checkEntryTiers.ts` prints
`next day in HH:MM:SS` and answers this in one command.

---

## 4. Step 2 — pre-registration

`6e3fa22e`, committed 17:20Z with `dayProgressEntities` null and `dayDocs[2]`
0/20 verified at 17:14–17:18Z. Six sessions running. It pre-registered the
forecasts from the LIVE gear read (not the brief's stale table), the branch on
which faction would be charged, and the gate rule.

---

## 5. Step 5 — the four dungeon runs

**Each had its own go-ahead.** The user was asked before run 1, again before
run 2, again before run 3, again before run 4. No blanket approval was taken or
claimed.

| run | id | outcome | first-attempt failures | HC | DR |
|---|---|---|---|---|---|
| 1 | 25462357 | death @ room 10 | 0/62 | 4944 | 687 |
| 2 | 25462418 | death @ room 10 | 0/63 | 4824 | 687 |
| 3 | 25462556 | death @ room 7 | 0/58 | 3216 | 309 |
| 4 | 25462652 | death @ room 12 | 0/97 | 5832 | 1005 |

**Totals: 12/12 run-units, 240 energy, 0/280 first-attempt failures, Hard Core
18,816, Dendren Root 2,688.**

### Every forecast landed exactly

| | open | r1 | r2 | r3 | r4 |
|---|---|---|---|---|---|
| Chobo (134) | 30 | 27 | 24 | 21 | **18** |
| 640 | 34 | 31 | 28 | 25 | 22 |
| 641 | 12 | 9 | 6 | 3 | **0** |
| 901 | 26 | 23 | 20 | 17 | 14 |
| 905 | 12 | 9 | 6 | 3 | **0** |

Chobo was the **sole mover** on all four runs, −3 each. Charge shape 33/33 →
**37/37**. The rod read **40** after every dungeon run — the disjoint-wear-sets
claim confirmed a further four times.

**The gear halt fired after run 4** with 641 and 905 both at 0, exactly as
pre-registered, at zero cost because the run-unit cap bound at the same moment.

Rule 8's **Perpetual filter fired 7 times** — run 2 (rooms 3, 7), run 3
(room 7), run 4 (rooms 2, 3, 9, 12). Every `TIER-CHECK` line reported OK.

---

## 6. Step 4 — fishing, and why it is 2 casts

The user repaired the rod (**923: 6 → 40**) and one `--oil-batch` invocation ran
at `castCap: 2`:

```
▸ cast 1/2  ★ necessity-gated LETHAL trigger: fish at 2/18 HP — using one.
            ▸ cast over: caught after 1 turns — CAUGHT!
▸ cast 2/2  ▸ cast over: escaped after 8 turns
▸ BATCH HALT (cast_cap) — 2 of 2 casts completed — the intended exit.
▸ rod durability after: 38 (before: 40, delta -2 over 2 cast(s) = 1.00/cast)
```

**The user then closed the session.** 2 played / 2 charged of a 30-cast scope.
1 Relaxing oil consumed (28 → 27), Focus 0. No cast refusal occurred, so the
server's refusal boundary stands at **24, 25, 27** with no fourth point — and a
missing refusal is not evidence it moved.

---

## 7. ⭐ Step 3 — THE GATE: FAIL, and it is a clean fail

The tripwire arms at **n ≈ 100** Dendren-only casts. Two casts took the corpus
to **n = 76**. **It did not arm.**

The reading at that n, computed with `splitByDealtDeck` rather than hand-counted:

```
DENDREN-ONLY  n=76   caught=38   rate=50.0%
POOLED        n=509  caught=255  rate=50.1%
GOLKAN        n=307  caught=183  rate=59.6%
```

**The brief's baseline (37/74 = 50.0%) is VERIFIED** — rule 9 pass.

⚠ **Dendren catches WORSE than Golkan in live play, 50.0% against 59.6%.**
Recorded as an observation and NOT as a re-opening of the settled sim result
("Dendren is BETTER, +3.23pp at n=40k/arm"): the live comparison straddles era
changes, n=76 is small, and the brief's own arithmetic says detecting a 3pp
effect live needs ~87 sessions. **No live study was commissioned, either way.**

⚠ **`scripts/fishBatchReport.ts` is the WRONG instrument for this** and the
brief named it. It is SESSION-scoped: run before any cast it printed
`catch rate 0.0%`. The corpus-wide Dendren slice comes from
`scripts/redrawDeckSlice.ts` / `splitByDealtDeck`.

---

## 8. ⭐ The session's real finding: the first-ever `Vulnerable` exception

`tests/statusEffects.test.ts` went red on three assertions whose counts had
**decreased** — impossible for an append-only corpus, which is what made it
worth chasing rather than patching. The assertions were `expect(r.ok).toBe(r.n)`:
77 of 78, not 78 of 78. **A new exception, not a smaller corpus.**

`run-2026-09-09-17-28-53/state-120.json`, room 9 of run 1:

```
attacker 0 (player), victim 1 (enemy)
atk 39, victim beforeStatus { Vulnerable: 1 }, attacker beforeStatus {}
every proc flag FALSE — no crit, block, evade, intuition or tenacity
expected floor(39 * 1.25) = 48
server dealt          52
```

Splitting the whole corpus on whether `VulnerableMastery` was active for that
victim separates it **perfectly**:

```
VulnerableMastery ABSENT   84/84 obey 1.25   (exceptionless)
VulnerableMastery ACTIVE    0/1  obey 1.25
```

The run had picked `VulnerableMastery(10)` at room 5 (state-067), well before
this exchange.

⛔ **It is not modelled and it is not named.** A new boon effect from n=1 needs
a [USER] directive, and n here is exactly 1. Worse, n=1 cannot separate the
candidates even in principle — at atk 39, `floor(39×4/3)`, `floor(39×1.35)` and
`floor(39×1.25)+4` **all give 52**. `VulnerableMastery` has
`val1Min === val1Max === 10`, so its value never rolls and more PICKUPS will not
help; separating these needs exchanges at **different `atk` values**.

Encoded in `tests/statusEffects.test.ts` as a new describe block that pins the
84/84–0/1 split and asserts `BOON_MODELS.VulnerableMastery` is `undefined`, so
modelling it without a directive fails the build.

---

## 9. Three new latent boon types — the largest single-session addition

`tests/boons.test.ts` failed with "has a pair but no model" on three types.
That is the fail-closed path for a boon type that acquires its first before/after
pair. All three were checked against their fixtures as **latent no-ops at
pickup** — the only field of the player object that moved is `pickedBoons`;
`hp`, `hpMax`, `armor`, `armorMax` and every ROLLED stat are byte-identical.

| type | run / states | Rarity | TokenId | val1 | rolls? |
|---|---|---|---|---|---|
| `LossLuckUp` | 17-28-53 / 123→124 | Rare | 113 | 5 | no |
| `IntuitionArmor` | 17-45-45 / 023→024 | Rare | 101 | **7** | **YES (7–10)** |
| `AddWeakShield` | 17-55-35 / 031→032 | Rare | 92 | 2 | no |

All three added to `AWAITING_MODEL_DIRECTIVE`. The held list goes **7 → 10**.
`UNMODELLED_TYPES` is unchanged at 13.

⚠ **`IntuitionArmor` ROLLS**, and this pickup drew the bottom of its range. A
single pickup cannot pin even its magnitude.

---

## 10. The crossed bound in `deckShuffle`, and why both nulls now matter

`expect(sequential.length).toBeLessThanOrEqual(5)` returned **6**, at **515**
opening hands. Session 105 set that 5 by deriving it — "chance will not reach it
for the life of this corpus" — so bumping it to 7 would be the exact fragility
that derivation was fixing.

Re-derived on both nulls the file already names, at 515 hands (session 105's
ordered per-hand rate is 0.2076/253 = 8.206e-4):

```
ORDERED-uniform null   lambda = 0.423   P(>=6) ~ 5.2e-6   (~1 in 190,000)
SET null               lambda = 2.361   P(>=6) ~ 3.5%     (ordinary)
```

**The two nulls now disagree about whether this is an anomaly, and that
disagreement is the finding.** Session 79 ruled the SET null out on the grounds
that roster order is not a display artefact; this crossing is what puts that
ruling back in question. It is NOT re-opened here on one session's data.

Converted to a PIN at 6, with `LIVE.length` pinned at 515 alongside so the pair
moves together. The discriminating ratio assertion still passes comfortably
(6/515 = 1.17% against a 2% bar), so **the session-79 falsification is
untouched** — what is in doubt is only the null used to police the residual.

---

## 11. Carry-forward, addressed by name

1. **Intuition is an information effect** — carried, untouched, no new evidence.
2. **§71 on [USER] HOLD** — **POOLED margin HELD at −1 for a THIRD session**,
   with byte-identical components (b10 124 fires / 43 rescues / 8 sacrifices =
   35; all3 160 / 51 / 15 = 36). Two casts moved it not at all. **DENDREN-ONLY
   reads −3** at n=76 (b10 net 4, all3 net 7). Both quoted, per item 5. **No
   decision taken.**
3. **Secret scan after `git add`** — done. 15,847 files, scope printed, PASS.
4. **Three crossed bounds became pins, not widenings** — carried forward and
   two of the three moved again this session, same direction:
   `|BASE_ARM − LIVE|` 0.5497 → **0.5566**, movePath constancy 0.8972 →
   **0.8957**. Both re-pinned. `LIVE.meanHeal` was re-pinned at 3.3034.
5. **`LIVE.drift` threshold NOT armed, streak keeps resetting** — −0.7235 →
   **−0.7199**, **REVERSED AGAIN**. Longest current run is **one**; magnitude
   ~0.72 against the 1.0 bar. **Neither arm is close. Do not re-count from
   five.** `damageHist` mode 5 pooled. Catch rate quoted pooled AND
   Dendren-only (§7) — the item that went unanswered twice.
6. **Crit anomalies** — no new ones this session; total stays 13.
7. **Latent boons** — now **TEN**, see §9. `Thorns`, `CritHeal`, `Intimidating`,
   `BurningTenacity`, `RegenMastery`, `VulnerableMastery`, `WeakeningBlock`,
   `LossLuckUp`, `IntuitionArmor`, `AddWeakShield`. Default HOLD.
8. **`OBSERVED_OFFERS` source labels use the BEFORE state** — the 35 rows added
   this session do. Generator reported EXTRA-IN-TABLE 0, so purely additive.
9. **Pins not updated mid-session** — updated only after the run-units were
   spent and the session was closed.
10. **`$TMPDIR` differs between sandbox modes** — cost a cycle for the THIRD
    consecutive session. Sandboxed `tsx` also fails outright with
    `EPERM: listen /tmp/claude-501/tsx-501/*.pipe`.
11. **Other dungeons OUT OF SCOPE** — not queried, not counted, not reported.
12. **`web/` has still never spawned a real script** — untouched.
13. **§0a NOT lifted; +19.40pp and +17.74pp NOT quoted.**

---

## 12. Offline work — NOT done, and why

Neither of the two offline questions the brief nominated was touched:
**`blockedMove` wiring** and **the 25% mitigator**. The brief scoped them as
"if an arm is blocked"; neither arm blocked until the dungeon reached 12/12,
and the session closed shortly after. Both remain free, offline, zero-spend
work and are carried as open questions 1 and 2.

---

## 13. Verification, against the final tree

```
vitest run --maxWorkers=4   2571 passed (2571), 116 files, exit 0
tsc --noEmit                exit 0
git diff --check            exit 0
secretScan.ts               scope tracked, 15847 files, PASS (run after staging)
secretScan.ts --scope=diff --ref=6e3fa22e   PASS
```

Corpus: **133 dungeon attempts** (was 129), **509 fishing casts** (was 507).
~85 pins re-derived over 12 automated passes plus ~20 hand edits.
