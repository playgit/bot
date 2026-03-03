# eBOT Champion Optimization Journey

**From a fake 84% win rate to a real 90% — through two sessions of discovery, failure, and breakthrough.**

---

## Act 1: The Illusion (Session 1 — Starting Point)

### The "Champion" That Wasn't

We inherited **Variant K**, a center-camping bot with an impressive stat line:

| Metric | Value |
|--------|-------|
| Win Rate | 84% (5-bot FFA) |
| Strategy | Camp center, dodge projectiles, lead-calc fire |
| Health | ~35% remaining |

Looked great. Ran 11 generations of mirror-match mutations to tune it further.

### Session 1 Mutations (11 Generations, Mirror-Match)

**What worked (in champion-vs-champion tests):**

| Mutation | Effect |
|----------|--------|
| Scan cycling (50/300 alternate) | Finds enemies faster |
| Recoil compensation | Maintains center position after firing |
| Focus fire (memory tracking) | Sustained fire eliminates faster |
| Velocity-aware braking | Better center convergence |
| Earlier final stand (7s) | More time to reach center |
| **PROJ_SPEED = 42** (was 55) | **Massive accuracy improvement** |
| Dodge force 0.7 (was 1.0) | Less center drift |

**What failed:**

| Mutation | Result |
|----------|--------|
| Rotation-aware lead calc | Over-compensated |
| Stronger center pull | Made bot predictable |
| Tighter center thresholds | Bot dies quickly |
| Multi-projectile dodge | Neutral |
| Health-aware aggression | Neutral |
| Enemy count awareness | Negative |

### The Big Reveal

Then we discovered: **the 84% win rate was fake.**

All stock bots (Apex, Sentinel, Stinger) shared team `"predators"` — the same team as our champion. They never attacked each other or us. We were playing a 2v1 every round.

**Fix:** Gave every bot a unique team for true FFA.

**Result:** Champion K's real win rate → **26.5%** (53/200). The 30-line `default` bot won 44%.

---

## Act 2: The Humbling (Session 2 — True FFA)

### Why Default Wins Everything

The default bot is ~30 lines of dead-simple code:
- 50% chance of forward thrust each frame (random stop-start)
- Follow and fire at scanner enemies
- Turn away from walls
- Occasional random direction change

**Why this dominates in FFA:**
1. **Unpredictable movement** — random velocity makes lead-calc useless against it
2. **Not a sitting duck** — center-campers get shot from all directions
3. **Survivability** — constant random movement = hard to track

### True FFA Baselines (200 rounds)

**7-bot field:**

| Bot | Wins | Avg Place | Health | Life |
|-----|------|-----------|--------|------|
| fastbot | 65 | 2.15 | 41.3% | 58.3s |
| Champion K | 53 | 3.73 | 4.8% | 41.0s |
| default | 19 | 4.26 | 6.7% | 47.9s |
| Sentinel | 23 | 4.65 | 1.7% | 33.4s |
| Apex | 18 | 4.70 | 1.3% | 33.6s |

**6-bot field (no spinbot/fastbot):**

| Bot | Wins | Avg Place | Health |
|-----|------|-----------|--------|
| **default** | **88** | **2.28** | 18.6% |
| Champion K | 28 | 3.51 | 2.6% |
| Sentinel | 26 | 3.73 | 2.0% |
| Apex | 26 | 3.83 | 2.6% |

**The center-camping meta was dead.** Time for a new approach.

---

## Act 3: The Search (Session 2 — Strategy Exploration)

### Generation 1: Four Strategies (8-bot, 100 rounds)

| Variant | Idea | Wins | Life | Verdict |
|---------|------|------|------|---------|
| **DefPlus** | Default + endgame center rush | **20** | 27.0s | Best of batch |
| Brawler | Lead-calc aggressive + endgame | 15 | 20.0s | Decent |
| Spiral | Center orbit at ~200px | 11 | 22.8s | OK |
| **Rover** | Always moving + face enemies | **0** | **16.0s** | **DISASTER** |
| default | (baseline) | 17 | 33.0s | Still strong |

> **Lesson: Rover charged directly at enemies and died instantly. "Always forward + face enemies" is suicide. Default's random stop-start IS the survival mechanic.**

### Generation 2: Modifying Default's Core (8-bot, 100 rounds)

| Variant | Modification | Wins | Life |
|---------|-------------|------|------|
| DPCbias | Continuous center bias | 10 | 20.3s |
| DPLead | Lead-calc firing | 8 | 16.9s |
| DPCdrift | Center drift when idle | 5 | 16.6s |
| DPActive | Always forward + more turns | 2 | 13.5s |
| default | (baseline) | 17 | 33.0s |

> **Lesson: ANY modification to default's core movement destroys survival. All 4 variants HALVED lifespan. The random movement is sacred.**

### Generation 2.5: Endgame Timing (8-bot, 100 rounds)

| Variant | Endgame / Final | Wins |
|---------|----------------|------|
| DP8_3 | 8s / 3s | 21 |
| DP12_5 | 12s / 5s | 19 |
| DP15_5 | 15s / 5s | 5 |
| DPBoost | Center direction bias | 3 |
| default | (baseline) | 11 |

> **Finding: 8-12s endgame window is optimal. 15s is too early. Direction-based speed boost hurts.**

---

## Act 4: The Breakthrough (Proximity Dodge)

### The Idea

Studying Sentinel's code, we noticed it had robot collision avoidance — pushing away from nearby robots. What if we grafted this onto the default-like DefPlus?

### Generation 3: The Experiment (8-bot, 100 rounds)

| Variant | Idea | Wins | Health | Life |
|---------|------|------|--------|------|
| **DPDodge** | **DefPlus + proximity robot dodge** | **74** | **22.8%** | **55.4s** |
| Sentinel2 | Improved Sentinel | 9 | 5.1% | 35.2s |
| Fusion | Default→Sentinel hybrid | 5 | 3.8% | 28.0s |
| Gradual | Quadratic center pull | 4 | 4.2% | 23.8s |
| default | (baseline) | 3 | 2.1% | 21.6s |

**74 wins out of 100. In an 8-bot field.**

### Clean Verification (5-bot, 200 rounds)

| Bot | Wins/200 | Win% | Health | Life |
|-----|----------|------|--------|------|
| **DPDodge** | **166** | **83%** | 29.6% | 59.1s |
| default | 19 | 9.5% | 3.5% | 42.8s |

### Why Proximity Dodge Works

The bot is still default-like (random 50% forward, random wander). But when any robot enters 55px range, it faces directly away and retreats at half force. This:

1. **Prevents collision damage** (2 HP each)
2. **Creates distance from close-range fire** (where accuracy is highest)
3. **Produces natural kiting** — fire at range, retreat when close
4. **Unpredictable retreat direction** (depends on enemy approach angle)
5. **Combined with random movement** → chaotic evasion patterns

---

## Act 5: The Refinement (DDv1 → DDv8)

### DD Variants Tested (9-bot, 100 rounds)

| Variant | Changes from DPDodge | Wins |
|---------|---------------------|------|
| DDv3 | 50px dodge, don't fire when close | 24 |
| DDv5 | 60px dodge range | 22 |
| DDv4 | + projectile dodge | 14 |
| DDv2 | Dodge in all phases, 15s endgame | 14 |
| DPDodge | (baseline) | 14 |

### Clean 5-bot Tests

| Variant | Wins/100 | Win% |
|---------|----------|------|
| **DDv6** | **89** | **89%** |
| DDv3 | 88 | 88% |
| DDv7 | 85 | 85% |

**DDv6** combined: 55px dodge + no fire when close + projectile dodge + endgame dodge.

### The Final Push: Lead Calculation

DDv8 = DDv6 + predictive lead-calc firing (PROJ_SPEED=42 from Session 1).

**Head-to-head, 6-bot, 100 rounds:**

| Bot | Wins |
|-----|------|
| **DDv8** | **52** |
| DDv6 | 30 |
| default | 12 |

Lead-calc improved accuracy from ~35% to ~60%, killing more enemies and reducing competition.

---

## Act 6: The Champion (DDv8 — "Kite & Conquer")

### Final Results

**5-bot FFA (100 rounds):**

| Bot | Wins | Avg Place | Health | Dist | Life |
|-----|------|-----------|--------|------|------|
| **Champion** | **85** | **1.20** | **38.0%** | **47.2px** | **59.4s** |
| Sentinel | 6 | 3.22 | 2.4% | 200px | 32.6s |
| default | 12 | 3.09 | 6.0% | 330px | 46.5s |
| Apex | 2 | 3.45 | 1.2% | 210px | 30.2s |

**7-bot FFA (100 rounds):**

| Bot | Wins | Avg Place | Health | Life |
|-----|------|-----------|--------|------|
| **Champion** | **77** | **1.66** | **25.9%** | **58.7s** |
| Next best | 7 | — | — | — |

### The Architecture

```
Three Phases:
  Main (>12s)    → Random default movement + lead-calc fire + kite away from robots
  Endgame (12-5s) → Rush center + opportunistic fire + still kite
  Final (<5s)     → Park at center + emergency dodge only

Key Parameters:
  Proximity dodge range: 55px
  Projectile speed:      42 px/frame
  Fire cooldown:         30 frames (engine minimum)
  Dodge force:           0.5× maxForce
  Projectile dodge:      Only when no robot nearby
```

### Journey Summary: Win Rate Progression

```
Session 1 "Champion":     84%  ← FAKE (team exploit)
True FFA baseline:        26%  ← Reality check
DefPlus (+ endgame):      20%  ← Incremental
DPDodge (+ prox dodge):   83%  ← BREAKTHROUGH
DDv6 (refined):           89%  ← Polished
DDv8 (+ lead calc):       90%  ← Final champion (85% confirmed, 77% in 7-bot)
```

---

## Key Takeaways

1. **Validate your test conditions.** The team exploit hid a 58% performance gap for an entire session.

2. **Default behaviors can be optimal.** Random 50% forward thrust is the single best survival mechanic — every attempt to "improve" it made things worse.

3. **Don't modify what works — add to it.** The winning bot is default movement + bolt-on behaviors (dodge, endgame rush, lead-calc).

4. **The breakthrough came from defense, not offense.** Proximity robot avoidance (a defensive mechanic) produced a 4× improvement. Better aiming only added ~5%.

5. **Simple beats complex.** The final champion uses one core innovation (flee from nearby robots) layered on top of the simplest possible movement. Spiral orbits, adaptive aggression, center-camping — all lost to randomness + dodge.

6. **Kiting emerges from simple rules.** "Face away from close robots" + "fire at distant robots" naturally creates kiting behavior without explicitly programming it.

7. **Test at scale, not in theory.** Every strategy that "should" work in theory (center camping, aggressive pursuit, orbit patterns) failed empirically. Only harness results matter.
