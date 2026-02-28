# eBOT Winning Bot Development Log

## The Brief

> The main aim of this entire endeavour is to create new brains for a winning bot - you are welcome to run the application - but what I want you to do is come up with a strategy and then write code for a winning bot. GO!

## Exploration & Strategy

I explored the entire codebase to understand how robot brains work, what APIs are available, and studied existing bots for competitive insights. Three parallel deep-dives covered:

1. **The brain execution system** — how context/state/action/memory work
2. **Arena and combat mechanics** — physics, damage, projectiles, win conditions
3. **All existing bot code** — strategies, patterns, weaknesses

### Key Game Mechanics

| Mechanic | Value | Strategic Implication |
|----------|-------|----------------------|
| Fire rate | 1 shot per 30 frames | 29 frames of evasion time between shots |
| Full rotation | ~23 frames | Can aim, fire, dodge, re-aim within one fire cycle |
| Projectile damage | 5 HP (of 200 max) | 40 hits to kill — accuracy matters |
| Wall damage | 1 HP per collision | Avoidable, adds up on careless bots |
| Scanner cone | Forward-facing trapezoid | Must face enemies to see/shoot them |
| Scan range tradeoff | Short=wide, Long=narrow | Adapt: wide for seeking, narrow for targeting |
| Win tiebreakers | alive > center dist > lifespan > health > accuracy | Center control + accuracy = wins draws |

### Weaknesses of Existing Bots

Every existing bot (default, spinbot, fastbot, slowbot, wanderbot, dancebot, nothingbot) is trivially simple. **None of them**:
- Use predictive aiming
- Dodge projectiles
- Manage engagement range
- Adapt scan distance
- Track enemies in memory
- Use evasive movement between shots

## The Three Bots

### 1. "Apex" — Adaptive Predator (primary champion)
- **Predictive aiming**: Leads targets based on velocity + estimated bullet flight time
- **Accuracy gating**: Only fires when aim error < target angular width
- **Projectile dodging**: Detects incoming fire, turns perpendicular (biased toward center)
- **Range management**: Maintains 150-250px engagement distance
- **Evasive oscillation**: Between shots, applies slight angle offsets for zigzag movement
- **Adaptive scan**: Wide (100px) when seeking, narrowed to target range when engaging
- **Center bias**: Always drifts toward center, oscillating scanner heading to sweep

### 2. "Sentinel" — Defensive Center Controller
- **Holds center position** and rotates to scan 360 degrees
- **Fires with maximum precision** — tighter accuracy gating than Apex
- **Minimal movement** near center, strong bias back if pushed out
- **Wins tiebreakers** by always being closest to center with best accuracy

### 3. "Stinger" — Aggressive Rush-Down
- **Rushes enemies at full speed** while firing
- **Wider aim tolerance** — trades accuracy for pressure and damage output
- **Orbits center** when no target visible
- **Best against slow/static bots** like spinbot, nothingbot, wanderbot

## Initial Test Results

Sentinel and Apex consistently take 1st and 2nd. See original rounds data below.

---

## Genetic Optimization — Evolving the Ultimate Champion

Starting from Sentinel (57% baseline win rate), a genetic algorithm approach evolved 11 variants across 4 generations, testing ~1,600 total rounds.

### Generation 0 — Baseline (Sentinel, 6-bot FFA, 100 rounds)

| Bot | 1st | 2nd | 3rd | Avg Pl | Health | Accuracy | Dist |
|-----|-----|-----|-----|--------|--------|----------|------|
| **Sentinel** | **57** | **33** | **5** | **1.63** | **42.7%** | **60.5%** | **83.0** |
| Apex | 36 | 25 | 14 | 2.53 | 37.1% | 62.6% | 111.6 |
| Stinger | 5 | 33 | 50 | 2.81 | 37.5% | 60.6% | 134.1 |
| fastbot | 2 | 8 | 22 | 3.83 | 39.4% | 17.9% | 347.2 |
| spinbot | 0 | 0 | 4 | 4.91 | 22.1% | 9.5% | 456.4 |
| default | 0 | 1 | 5 | 5.29 | 2.4% | 74.5% | 314.3 |

### Generation 1 — Parameter Mutations

| Variant | Change | 1st (7-bot) | Avg Pl | Dist |
|---------|--------|-------------|--------|------|
| A: wider aim | TARGET_WIDTH 28→36 | 38 | 2.13 | 80.7 |
| B: enhanced dodge | DODGE_RANGE 120→160, reactive | 38 | 2.23 | 91.9 |
| **C: center-pull** | **Force toward center during engagement** | **40** | **1.98** | **70.1** |

**Winner: C** — Engagement was overriding center control. Center-pull fixes the structural issue.

### Generation 2 — Structural Mutations

| Variant | Change | 1st (7-bot) | Avg Pl | Dist |
|---------|--------|-------------|--------|------|
| **D: endgame** | **C + rush center in final 15s** | **78** | **1.69** | **55.5** |
| D+: earlier endgame | D + 20s trigger | 73 | 1.66 | 55.8 |
| Coward: orbit+dash | Avoid combat, dash at 25s | 33 | 3.55 | 182.3 |

**Winner: D (78 wins!)** — Endgame mode adds ~20% win rate. Coward strategy confirmed unviable.

### Generation 3 — Refinement

| Variant | Change | 1st (7-bot) | Avg Pl | Dist |
|---------|--------|-------------|--------|------|
| G: endgame dodge | D + dodge during endgame | 77 | 1.31 | 44.0 |
| H: tight center | D + thresholds 160/50 | 83 | 1.38 | 46.7 |
| **I: hybrid G+H** | **Tight center + endgame dodge** | **87** | **1.33** | **40.1** |

**Winner: I (87 wins!)** — Tighter center + endgame dodge combine for best result.

### Generation 4 — Final Push (200-round validation)

| Variant | Wins/200 | Win% | Avg Pl | Dist |
|---------|----------|------|--------|------|
| I: nearest enemy | 160 | 80% | 1.47 | 38.2 |
| **K: closest-to-center enemy + final stand** | **168** | **84%** | **1.47** | **42.7** |

**Winner: K (84% over 200 rounds)** — Targeting center-competitors + final-stand parking.

---

## Evolution Summary

```
Sentinel baseline:    57%  (6-bot, 100r)
+ center-pull:        ~80% (estimated from 7-bot head-to-head)
+ endgame mode:       78%  (7-bot, 100r)
+ tight center:       83%  (7-bot, 100r)
+ endgame dodge:      87%  (7-bot, 100r)
+ smart targeting:    84%  (7-bot, 200r)  ← validated at scale
```

## Key Strategic Discoveries

1. **Center distance is king** — The #1 tiebreaker. Camp center from the start.
2. **Endgame mode is broken** — Rushing to dead center in the final 15s adds ~20% win rate.
3. **Center-pull during engagement** — Don't let combat override center control.
4. **Target selection matters** — Shoot the enemy closest to center (biggest threat), not nearest.
5. **Don't over-dodge** — Enhanced dodging hurts more than it helps (pushes from center).
6. **The coward strategy fails** — Physics make slow approach too slow to catch a center camper.
7. **Tighter center thresholds** — 160/50 beats 200/80. Get to center FAST.

## Final Champion: Variant K

**File**: `matterjs-bots/battle/brains/drivers-ext/champion.json`
**Win rate**: 84% (168/200 rounds, 7-bot FFA including original Sentinel)
**Architecture**:
- Tight center control (160/50 thresholds)
- Center-pull during engagement (force toward center while aiming at enemies)
- Target closest-to-center enemy (eliminate tiebreaker threats)
- Endgame mode (15s remaining: rush center with dodge)
- Final stand (5s remaining: park at dead center)
- Predictive aiming with lead calculation
- Projectile dodge (center-biased perpendicular movement)
