# CORPUS-2026-08-23A — the corpus `session-86-redraw-revisit.md` was computed on

**This is a LABEL, not a recomputation.** Nothing in the memo was re-run to
produce it and no number in the memo moved. [session 87 §1 / GATE 0]

## Why it exists

QUESTIONS §28 asks the user to re-price a verdict **on a specific set of
numbers**, and session 87 spends a 20-cast fishing batch that grows the corpus
those numbers are computed on. The moment a cast lands, `loadCastTraces()`
returns something the memo does not describe — and nothing in the memo, §28, or
a recap would show that it happened. **A question asked on one corpus and read
on another is not the same question.**

So the corpus is pinned here by name, and the memo and §28 each carry one line
pointing at this file.

## The predicate — an `as-of` cut on `doc.createdAt`

The existing loader already supports this: `loadCastCreatedAt()`
(`src/sim/fishing/castEra.ts:91`) returns `docId -> doc.createdAt` off the same
committed tree `loadCastTraces()` walks, with the same `raw/` exclusion, and
`createdAt` is constant across a cast's states (148 of 148, re-checked by
`assertCastEraSound`). **No new persistence path and no new module were added
for this snapshot**, and `todaysEraCastIds()` is NOT used — it reads the
gitignored `data/ringPrediction.jsonl` and that prohibition is unchanged.

```
CORPUS-2026-08-23A  ==  { docId : doc.createdAt <= "2026-08-23T00:20:47.236Z" }
```

That bound is the **maximum `createdAt` in the corpus as the memo was
computed**, not a round number — cast `13041486`. Every cast session 87 or later
adds sorts strictly above it: the batch was cast after 16:55 PT on 2026-08-23
(≈ `2026-08-23T23:55Z`), so the cut separates the two eras of the FILE by more
than 23 hours. A date-granularity cut would NOT have worked, because new casts
carry the same calendar date.

The 148-member roster is listed verbatim at the end of this file, so the
snapshot is reproducible from the ids alone if `createdAt` ever moves.

## The frozen denominators, each with the filter that produced it

| figure | value | filter |
|---|---|---|
| traces | **148** | `loadCastTraces()`, whole tree |
| clean traces | **147** | `isCleanTrace(t)` |
| resolved casts | **147** | `t.caught \|\| t.escaped` |
| plays | **612** | `playCount(t)` summed — non-terminal plays, `castEra.ts:175` |
| casts, before / today | **94 / 54** | `eraOf()`, boundary `2026-08-21` |
| resolved, before / today | **93 / 54** | `eraOf()` ∧ `caught \|\| escaped` |
| plays, before / today | **410 / 202** | `eraOf()` ∧ `playCount` |

⚠ **`plays` is 612 under `playCount` and 760 under `turns.filter(x => x.play !== undefined)`.**
The memo, `matcherHeadroom.ts`, `zoneAudit.ts` and `castEra.test.ts` all use the
former. Session 81 lost time to exactly this — a pinned count with no predicate
beside it — so both numbers are written down here rather than one.

## What in the memo is frozen to this snapshot

Every quantitative claim in `session-86-redraw-revisit.md` §3, §4, §5 and §6,
and therefore every number QUESTIONS §28 asks about:

- §3 mana slack — pooled 132/147 (89.8%) mean 5.85 median 7; today 48/54
  (88.9%) mean 6.26 median 7; before 84/93 (90.3%) mean 5.61 median 6
- §4 opening headroom 6.8 HP, miss heal 3.02, ~2.3 net misses
- §5 the counterfactual — today n=127 plays, 15 dead hands (11.8%),
  rescue **15/15, 95% CI [79.6%, 100.0%], n = 15**, cost 1.33, availability
  88.2% → 97.6%; before n=262, 30/86
- §6 the shipped trigger's fire rate — today 26/204 (12.7%), before 93/245
  (38.0%), pooled 119/449 (26.5%)

§6 is the one exception worth naming: it is counted off `logs/fishing-*.jsonl`,
which is gitignored and local, so it is frozen by the same wall-clock cut but
**not** by the docId roster. Its 204 logged decisions and the corpus's 202
today-era plays were never proved to be the same casts (the memo says so).

## The rule for anything measured after the batch

**Report a re-read figure as a NEW row BESIDE the frozen one, never over it.**
If a number in the memo is ever recomputed on a grown corpus, it is a different
number and gets a different label — `CORPUS-2026-08-23A` stays what §28 was
asked about.

---

## Roster — 148 docIds, `createdAt` ascending

```
2026-08-15T20:32:47.231Z  before  12923189
2026-08-15T20:38:17.305Z  before  12923265
2026-08-15T20:38:29.840Z  before  12923267
2026-08-15T20:38:38.649Z  before  12923272
2026-08-15T20:38:51.648Z  before  12923274
2026-08-16T01:57:06.254Z  before  12925773
2026-08-16T01:57:18.405Z  before  12925775
2026-08-16T01:57:27.004Z  before  12925778
2026-08-16T01:57:35.472Z  before  12925779
2026-08-16T16:18:41.086Z  before  12934447
2026-08-17T00:03:29.596Z  before  12942017
2026-08-17T00:03:39.356Z  before  12942020
2026-08-17T00:03:51.760Z  before  12942026
2026-08-17T00:04:00.017Z  before  12942030
2026-08-17T00:04:12.832Z  before  12942037
2026-08-17T00:12:56.619Z  before  12942144
2026-08-17T00:13:32.622Z  before  12942155
2026-08-17T00:13:40.940Z  before  12942159
2026-08-17T00:14:00.626Z  before  12942167
2026-08-17T05:34:29.421Z  before  12944907
2026-08-17T05:34:41.870Z  before  12944911
2026-08-17T05:34:49.980Z  before  12944916
2026-08-17T05:34:57.951Z  before  12944922
2026-08-17T05:35:06.818Z  before  12944926
2026-08-17T05:35:16.325Z  before  12944936
2026-08-17T05:57:37.799Z  before  12945306
2026-08-17T05:57:46.392Z  before  12945310
2026-08-17T05:57:55.548Z  before  12945313
2026-08-17T05:58:02.882Z  before  12945315
2026-08-17T05:58:15.941Z  before  12945319
2026-08-17T20:35:48.820Z  before  12956657
2026-08-17T20:35:58.271Z  before  12956660
2026-08-17T20:36:45.314Z  before  12956670
2026-08-17T20:36:54.261Z  before  12956675
2026-08-17T20:38:59.190Z  before  12956696
2026-08-17T20:41:00.384Z  before  12956718
2026-08-17T20:41:16.426Z  before  12956724
2026-08-17T20:41:24.714Z  before  12956727
2026-08-17T21:09:31.212Z  before  12956997
2026-08-17T21:10:18.960Z  before  12957007
2026-08-17T21:11:48.555Z  before  12957029
2026-08-17T21:11:56.664Z  before  12957031
2026-08-17T21:13:53.041Z  before  12957061
2026-08-17T21:14:02.873Z  before  12957065
2026-08-17T21:15:52.573Z  before  12957096
2026-08-17T21:17:09.553Z  before  12957105
2026-08-17T21:17:17.914Z  before  12957107
2026-08-17T21:18:27.431Z  before  12957122
2026-08-17T21:18:38.717Z  before  12957127
2026-08-17T21:18:49.710Z  before  12957129
2026-08-18T22:59:56.627Z  before  12975152
2026-08-19T00:52:35.139Z  before  12975700
2026-08-19T00:52:47.769Z  before  12975704
2026-08-19T00:53:04.285Z  before  12975708
2026-08-19T00:53:16.598Z  before  12975713
2026-08-19T00:53:37.298Z  before  12975717
2026-08-19T00:53:58.451Z  before  12975724
2026-08-19T00:54:08.180Z  before  12975728
2026-08-19T00:54:21.884Z  before  12975733
2026-08-19T00:54:38.779Z  before  12975736
2026-08-19T00:54:50.075Z  before  12975740
2026-08-19T00:55:06.663Z  before  12975744
2026-08-19T00:55:18.998Z  before  12975745
2026-08-19T00:55:37.277Z  before  12975750
2026-08-19T00:55:48.342Z  before  12975751
2026-08-19T00:56:01.918Z  before  12975753
2026-08-19T00:56:19.666Z  before  12975755
2026-08-19T05:13:55.198Z  before  12978000
2026-08-19T05:14:16.258Z  before  12978003
2026-08-19T18:45:19.475Z  before  12988700
2026-08-19T18:45:34.662Z  before  12988705
2026-08-19T18:45:48.065Z  before  12988708
2026-08-19T18:46:07.341Z  before  12988710
2026-08-19T18:46:27.789Z  before  12988717
2026-08-19T21:27:05.015Z  before  12991310
2026-08-19T21:27:15.004Z  before  12991312
2026-08-19T21:27:26.040Z  before  12991317
2026-08-19T21:27:37.099Z  before  12991320
2026-08-19T21:27:52.403Z  before  12991326
2026-08-19T21:32:06.971Z  before  12991353
2026-08-19T21:32:27.312Z  before  12991355
2026-08-19T21:32:44.240Z  before  12991359
2026-08-19T21:33:04.860Z  before  12991361
2026-08-19T21:33:17.102Z  before  12991364
2026-08-19T22:22:46.824Z  before  12992258
2026-08-19T22:23:03.314Z  before  12992261
2026-08-19T22:23:24.059Z  before  12992267
2026-08-19T22:23:35.473Z  before  12992271
2026-08-19T22:23:46.287Z  before  12992272
2026-08-20T18:27:36.946Z  before  13004295
2026-08-20T18:27:49.223Z  before  13004301
2026-08-20T18:28:00.555Z  before  13004305
2026-08-20T18:28:10.485Z  before  13004306
2026-08-20T18:28:24.964Z  before  13004315
2026-08-21T14:46:17.309Z  today   13018502
2026-08-21T15:25:58.311Z  today   13018972
2026-08-21T15:26:18.906Z  today   13018980
2026-08-21T15:26:32.971Z  today   13018983
2026-08-21T15:26:48.478Z  today   13018987
2026-08-21T15:27:01.368Z  today   13018990
2026-08-21T15:27:15.477Z  today   13018993
2026-08-21T15:33:45.356Z  today   13019015
2026-08-21T16:47:53.807Z  today   13019665
2026-08-21T16:48:11.260Z  today   13019672
2026-08-21T16:48:30.499Z  today   13019677
2026-08-21T16:48:48.955Z  today   13019682
2026-08-21T17:00:23.369Z  today   13019755
2026-08-21T17:00:35.768Z  today   13019756
2026-08-21T17:05:52.392Z  today   13019822
2026-08-21T19:58:29.316Z  today   13022748
2026-08-21T20:11:06.794Z  today   13022872
2026-08-21T20:11:19.571Z  today   13022874
2026-08-21T20:11:38.565Z  today   13022875
2026-08-21T20:11:52.549Z  today   13022876
2026-08-21T21:59:22.664Z  today   13024476
2026-08-21T21:59:50.786Z  today   13024510
2026-08-21T22:00:07.376Z  today   13024527
2026-08-21T22:00:23.885Z  today   13024544
2026-08-21T22:00:36.291Z  today   13024550
2026-08-21T22:00:55.930Z  today   13024562
2026-08-21T22:01:12.297Z  today   13024567
2026-08-21T22:01:26.198Z  today   13024574
2026-08-21T22:01:40.624Z  today   13024579
2026-08-21T22:01:54.124Z  today   13024581
2026-08-22T00:55:32.085Z  today   13025986
2026-08-22T00:55:42.041Z  today   13025987
2026-08-22T00:56:06.392Z  today   13025990
2026-08-22T00:56:18.872Z  today   13025991
2026-08-22T21:04:27.606Z  today   13039914
2026-08-22T21:04:40.046Z  today   13039923
2026-08-22T21:05:01.396Z  today   13039932
2026-08-22T22:39:55.779Z  today   13041045
2026-08-22T22:40:05.536Z  today   13041046
2026-08-22T22:40:28.728Z  today   13041048
2026-08-22T22:40:38.783Z  today   13041050
2026-08-22T22:40:49.591Z  today   13041052
2026-08-22T22:41:02.457Z  today   13041055
2026-08-22T22:41:16.158Z  today   13041058
2026-08-22T22:41:42.849Z  today   13041062
2026-08-22T22:43:33.148Z  today   13041085
2026-08-23T00:19:00.767Z  today   13041473
2026-08-23T00:19:14.855Z  today   13041474
2026-08-23T00:19:25.446Z  today   13041476
2026-08-23T00:19:36.539Z  today   13041477
2026-08-23T00:20:06.049Z  today   13041480
2026-08-23T00:20:21.135Z  today   13041482
2026-08-23T00:20:35.780Z  today   13041483
2026-08-23T00:20:47.236Z  today   13041486
```
