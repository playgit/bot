# eBOT Optimization Summary

## Starting Point
Sentinel — center-camping bot with predictive aiming and projectile dodging. **57% win rate** over 100 rounds (6-bot FFA).

## What Was Tried

### Failed Approaches
| Variant | Idea | Result | Why It Failed |
|---------|------|--------|---------------|
| A | Wider aim tolerance (28→36px) | No improvement | Lost precision without enough extra damage to compensate |
| B | Enhanced dodge (range 120→160, threshold 0.6→0.8) + reactive damage dodge | No improvement | Extra dodging pushed bot away from center, hurting tiebreaker position |
| D+ | Earlier endgame trigger (20s instead of 15s) | 73 wins (worse) | Too much combat time sacrificed — 15s is the sweet spot |
| Coward | Orbit at 250px, dash to center at 25s | 33 wins | Physics too slow — can't close 250px gap fast enough to beat a center camper |

### Winning Innovations (stacked incrementally)
| Gen | Variant | Innovation | Wins | Key Metric |
|-----|---------|-----------|------|------------|
| 1 | C | **Center-pull during engagement** — use dot-product to drift toward center while aiming at enemies | 40 (7-bot) | dist: 70→ from 83 |
| 2 | D | **Endgame mode** — abandon combat, rush to dead center in final 15s | 78 | +21 wins |
| 3 | H | **Tighter center thresholds** — 160/50 instead of 200/80 | 83 | dist: 47 |
| 3 | I | **H + endgame dodge** — dodge projectiles even during center rush | 87 | dist: 40 |
| 4 | K | **I + smart targeting + final stand** — target closest-to-center enemy; park motionless at center in last 5s | **168/200 (84%)** | Validated at scale |

## The 4 Key Discoveries

1. **Center distance is everything.** It's tiebreaker #2 (after survival) and most rounds end without elimination. Every improvement that reduced center distance increased wins.

2. **Engagement was overriding center control.** Sentinel's original code replaced `desiredAngle` with the enemy angle during combat. This meant forward thrust pushed the bot AWAY from center. Fix: use the dot-product of aim angle vs center angle to choose forward/reverse force.

3. **Endgame mode is overpowered.** Switching to pure center-rush at 15s remaining added ~20% win rate. The tiebreaker only measures position at the final frame.

4. **Target selection matters.** Shooting the enemy closest to center (your biggest tiebreaker rival) beats shooting the nearest enemy.

## Final Champion — Variant K
- **File:** `matterjs-bots/battle/brains/drivers-ext/champion.json`
- **Readable code:** `variant-k-brain.js`
- **Win rate:** 84% (168/200, 7-bot FFA)
- **Architecture:** Tight center control → center-pull engagement → endgame rush (15s) → final stand parking (5s)
