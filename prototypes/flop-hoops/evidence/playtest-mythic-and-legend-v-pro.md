# Playtest: Mythic (6) and Legend (5) against Pro (3) — iteration 37 build (252cc98)

Nothing was fixed. 60 matches each (30 seeds x both sides, 150 s, WATCH CPU, win score off), personalities on.
Harness: scratchpad playtest.js (per-controller levels). Raw: ai-duel style counts, no page errors in either run.

## Result
- Mythic 405 pts vs Pro 569: Pro won 41, Mythic 15, 4 ties.
- Legend 361 pts vs Pro 580: Pro won 48, Legend 10, 2 ties.
The higher level loses clearly. (Iteration 33's duel had Mythic ~level with Legend; both are far below Pro.)

## Basket make rates (attempts -> made)
| type | Mythic | Pro (vs Mythic) | Legend | Pro (vs Legend) |
|---|---|---|---|---|
| jump shot (near half) | 111 -> 6 (5.4%) | 279 -> 32 (11.5%) | 74 -> 5 (6.8%) | 284 -> 40 (14.1%) |
| fadeaway | 72 -> 49 (68.1%) | 251 -> 68 (27.1%) | 86 -> 49 (57.0%) | 264 -> 89 (33.7%) |
| long shot (2 pts) | 147 -> 60 (40.8%) | 329 -> 93 (28.3%) | 165 -> 52 (31.5%) | 282 -> 86 (30.5%) |
| dunk (started) | 176 -> 80 (45.5%) | 303 -> 100 (33.0%) | 198 -> 69 (34.8%) | 304 -> 114 (37.5%) |
| alley-oop dunk | 38 -> 28 (73.7%) | 7 -> 5 (71.4%) | 41 -> 29 (70.7%) | 11 -> 8 (72.7%) |
| lob thrown -> scores off the board | 112 -> 11 (9.8%) | 0 | 120 -> 9 (7.5%) | 0 |
| scrambles / loose-ball baskets | 90 | 128 | 79 | 91 |
Dunk misses: Mythic landed 38 / timeout 5; Pro landed 72 / timeout 19 (Legend run: 34/9 vs 65/18).

## Why Pro wins (winning vs losing matches, per-match averages)
- Pro shoots far more: 859 shots+fades+longs vs Mythic's 330, and starts 303 dunks vs 176. The high levels take few, high-quality shots and lose the volume game.
- Pro steals 1242 (Mythic 828); Legend run 1253 vs 886. The high level is stolen from more than it steals.
- Pro wins on scrambles/loose balls (128 vs 90) and on long shots when it wins (1.9 vs 0.7 per match).
- When Pro wins by 4+ (23 of 60 Mythic games): Mythic scores 4.5, Pro 12.2; Pro makes 2.2 dunks, 2.3 longs, 2.5 scrambles per match to Mythic's 1.2, 0.6, 0.9.
- When Mythic wins by 4+ (only 4 games): it makes 2.0 longs and 2.0 fades per match, blocks 3.8 (vs 0.8); Pro's dunks and scrambles are normal. Same shape for Legend (4 games: 2.0 fades, 4.2 blocks).
- So the high levels only win when their fadeaways/long shots land and they block well; efficiency is not the issue, volume and ball security are.

## Commonly occurring weird things
1. Perfect-line shooters rarely shoot: near-half jump shots are 5-7% for Mythic/Legend; only ~46 of 164 shots flagged perfect were scored as perfect. Fadeaways are their best shot (57-68%) yet only 72-86 per 60 matches.
2. Alley-oop lobs mostly fail: 112 lobs -> 11 scored off the board (9.8%); oop dunks that do start convert 74% (28 of 38). The lob is thrown a lot and rarely becomes an oop.
3. Ball leaves the top of the view: ~475-500 ball-position samples per run above y -300 (high lobs/arcs), in 18-19 of 60 matches. A few samples at y > 500 (below floor level) or x outside ~1080: 16-19 per run. Not confirmed as bugs.
4. Time standing behind a basket is high: ~17-18% of samples for both teams (was ~9% in my iteration-33 measure), in every level. Possible regression after iterations 34-37; not investigated.
5. Mythic dribbles out of dead shots a lot: 154 "NO PERFECT LINE: DRIBBLING OUT" (Legend 169) per 60 matches, then loses the ball often (steals against it 1242).
6. Self-pass is nearly absent in real play: 15 throws in 60 matches, 2 dunks after.
7. Slips are frequent at Pro (531) vs Mythic (176) — Pro's mistakes do not hurt it enough to matter.
8. "Landed" is the main dunk failure (Mythic 38 of 43 misses; Pro 72 of 91): carriers reach the dunk prompt and still come down without finishing.
9. Long holds: Mythic max hold per match averaged 2.5 s; no hold over 6 s was flagged, no frozen play (no 25 s event gaps), no player stuck upside-down for 3 s+, no page errors.
