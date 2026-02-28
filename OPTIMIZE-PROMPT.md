# eBOT Champion Refinement Prompt

> Paste this into a new Claude session. The current champion wins 84% of rounds. Your job is to push it higher through targeted mutations and structural experiments.

---

## YOUR MISSION

You are refining the **current champion bot** (Variant K, 84% win rate) for the eBOT arena. The bot already dominates — your goal is to squeeze out the remaining ~16% of losses through precision tuning and novel structural additions.

You will work in **generations**. Each generation:
1. Run the current champion as baseline (200 rounds for statistical confidence)
2. Create 2-3 **mutant variants** with targeted changes
3. Benchmark each variant (200 rounds, 14 parallel workers)
4. A variant MUST beat the baseline's win count AND avg placement to replace it
5. Repeat until you've exhausted ideas or hit 90%+

**IMPORTANT RULES:**
- The bot under test goes in `matterjs-bots/battle/brains/drivers-ext/champion.json`
- Always benchmark against the FULL field: `apex,sentinel,stinger,default,spinbot,fastbot,champion`
- Use **200 rounds** per test for statistical confidence (100-round runs have ±5% variance)
- Track every generation's results in a log
- The bot brain must be a single JavaScript string in a JSON file (VM2 sandbox, 500ms timeout)
- Memory limited to 1000 chars JSON-serialized
- Variables: `var` only (no `let`/`const`). No arrow functions.

---

## THE ARENA — Complete Game Mechanics

### Arena
- **900×900 pixel** square, wall boundaries (10px thick)
- **Center point**: (450, 450)
- **Round duration**: 60 seconds (3600 physics frames at 60 FPS)

### Robot Physics
| Property | Value | Notes |
|----------|-------|-------|
| Max Health | 200 HP | 100% = 0 damage taken |
| Max Force | 0.001 | Forward thrust per frame |
| Max Reverse | 0.0005 | Backward thrust (half of forward) |
| Max Rotation | 0.272 rad/frame | ~15.6°/frame, full 360° in ~23 frames |
| Air Friction | 0.03 | `velocity *= (1 - 0.03)` each frame |
| Body Size | ~24×30px polygon | ~15px effective radius |
| Restitution | 0.95 | Bounces off walls with 95% energy |

### Damage
| Source | Damage | HP equivalent |
|--------|--------|---------------|
| Projectile hit | 5 | 2.5% of max |
| Robot collision | 2 each | 1% of max |
| Wall collision | 1 | 0.5% of max |
| Brain error | 5 | 2.5% of max |

### Projectiles
| Property | Value |
|----------|-------|
| Fire rate | 1 shot per **exactly 30 frames** (0.5/sec) |
| Launch force | 0.001 (same as robot maxForce) |
| Size | 3px radius |
| **Air friction** | **0 — projectiles have ZERO drag, constant velocity after launch** |
| Spawn offset | 15px ahead of robot |
| Recoil | -0.001 force backward on firing robot |
| Cleanup | Removed when speed < 10 |

### Scanner (Forward-Facing Trapezoid)
| desiredScan | Range | Far-edge width | Coverage |
|-------------|-------|----------------|----------|
| 50 | 50px | ~216px | Ultra-wide, short |
| 100 | 100px | ~108px | Wide, medium |
| 150 | 150px | ~72px | Balanced |
| 200 | 200px | ~54px | Narrow, long |
| 300 | 300px | ~36px | Sniper |
| 450 | 450px | ~24px | Laser beam |

**Formula:** `far_width = robot_size × min(max(450 / desiredScan, 1), 10)`

### Proximity Sensor
- Omnidirectional, ~36px radius (robot maxDimension × 1.5)
- Detects robots and walls regardless of facing direction

### Win Condition & Tiebreakers (IN ORDER)
1. **Last robot alive**
2. **Closest to center** — measured at **final frame only** (not averaged)
3. **Longest lifespan**
4. **Most health remaining**
5. **Best accuracy**

---

## BRAIN API REFERENCE

```javascript
var s = context.state;    // READ-ONLY
var a = context.action;   // WRITABLE
var m = context.memory;   // PERSISTENT (1000 char limit)
var r = context.round;    // READ-ONLY

// State
s.position.x, s.position.y, s.angle, s.angleToCenter, s.health
s.maxForce (0.001), s.maxRotate (0.272), s.maxHealth (200)
s.team, s.name

s.scanner.robot[]  → .x, .y, .speed, .angle, .angleFromRobot, .range, .team, .active, .name
s.scanner.projectile[] → .x, .y, .speed, .angle, .angleFromRobot, .range
s.scanner.wall[] → .entitySubtype ("north"/"south"/"east"/"west"), .range, .angleFromRobot
s.proximity[] → .entityType, .range, .angleFromRobot (robots also: .name, .team, .active)
s.lastDamage[] → .type ("D3"=proj, "D4"=wall, "D5"=robot), .atFrame, .origin.entityType

// Actions
a.desiredAngle = radians;   // Turns at 0.272 rad/frame (NOT instant snap)
a.desiredForce = number;    // Applied once per frame then reset to 0
a.desiredLaunch = true;     // Fire if cooldown ready (30-frame minimum gap)
a.desiredScan = pixels;     // 50–450

// Round
r.remaining  // seconds left
r.active     // robots still alive
```

---

## PHYSICS EDGE: THINGS MOST BOTS GET WRONG

These are exact simulation details extracted from the source code. Use them.

### 1. Rotation Is Gradual, Not Instant
`desiredAngle` rotates the bot at **0.272 rad/frame** toward the target angle. It takes **~23 frames for a full 360°**. If you need to aim at an enemy 1 radian away, it takes **~4 frames** to get there. Factor this into lead calculations — by the time you're aimed, the enemy has moved.

**Optimization opportunity:** Pre-aim at the predicted enemy position `N` frames in the future, where `N = angDiff / 0.272` (frames to rotate).

### 2. Projectiles Have Zero Friction
Projectiles travel at **constant velocity** after launch (frictionAir=0, friction=0). This means the lead calculation is simpler than you might think — no need to account for projectile deceleration.

**Optimization opportunity:** The current bot uses `projSpeed=55` as a hardcoded estimate. This could be wrong. You could empirically calibrate it by tracking `s.scanner.projectile[].speed` values across ticks. If the actual speed differs from 55, the lead calculation is systematically off.

### 3. Center Distance = Final Frame Only
The tiebreaker measures your position at the **exact moment the round ends**, not averaged over time. This means the last few seconds matter infinitely more than the first 50 seconds for the center tiebreaker.

**Already exploited:** The champion's endgame/final-stand modes. But the timing (15s / 5s) may not be optimal.

### 4. Scanner Width Is Inversely Proportional to Range
At `desiredScan=50`, the scanner cone is **9× wider** than at `desiredScan=450`. When no enemies are in your scanner, you should use a SHORT scan to detect enemies in a wide arc. Once locked on, switch to longer range.

**Optimization opportunity:** The champion uses `desiredScan=250` when idle near center. Cycling between `50` (wide sweep) and `250` (long range) every few frames could find enemies faster.

### 5. Force-to-Velocity Relationship
`frictionAir=0.03` means terminal velocity = `force / (frictionAir × mass)`. At maxForce (0.001), the robot's terminal velocity is reached quickly. Reverse thrust is half-speed (0.0005). Backing away is always slower than advancing.

### 6. Recoil from Firing
Each shot applies `-0.001` force (full reverse thrust) for one frame. If you're trying to hold position at center, firing pushes you backward. The champion doesn't account for this — it fires while trying to maintain center position.

**Optimization opportunity:** After firing, apply a compensating forward thrust on the next tick, or accept the recoil and factor it into the center-pull calculation.

### 7. Robot Bounce = 0.95 Restitution
Robots bounce off walls with 95% energy. A bot pushed into a wall will bounce back almost as fast. Wall damage is only 1 HP per collision, but repeated bouncing adds up.

---

## CURRENT CHAMPION: VARIANT K (84% win rate, 200 rounds)

### Performance Baseline
| Bot | 1st/200 | Avg Pl | Health | Accuracy | Dist |
|-----|---------|--------|--------|----------|------|
| **Champion** | **168** | **1.47** | **34.1%** | **57.7%** | **42.7** |
| Sentinel | 13 | 2.71 | 35.5% | 61.5% | 103.4 |
| Apex | 14 | 3.23 | 31.2% | 64.6% | 118.7 |
| Stinger | 2 | 3.60 | 33.8% | 59.7% | 133.3 |
| fastbot | 2 | 4.71 | 34.5% | 21.3% | 348.0 |
| spinbot | 0 | 5.77 | 22.6% | 11.8% | 452.3 |
| default | 1 | 6.50 | 0.2% | 76.6% | 325.2 |

### The Champion's Brain (Annotated)

```javascript
var s=context.state,a=context.action,m=context.memory;
var PI2=Math.PI*2,PI=Math.PI;

if(!m.t){m.t=0;m.lf=-99;m.ev=1;m.dir=1;}
m.t++;

var clamp=function(v,lo,hi){return Math.max(lo,Math.min(hi,v));};
var angDiff=function(a,b){var d=(a-b)%PI2;if(d>PI)d-=PI2;if(d<-PI)d+=PI2;return d;};
var angTo=function(x1,y1,x2,y2){return Math.atan2(y2-y1,x2-x1);};
var dst=function(x1,y1,x2,y2){return Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1));};

var myX=s.position.x,myY=s.position.y,myA=s.angle;
var dCenter=dst(myX,myY,450,450);
var toCenter=s.angleToCenter;
var r=context.round;

// TARGET: closest-to-center enemy (biggest tiebreaker threat)
var enemy=false;
var bestEDist=9999;
for(var i=0;i<s.scanner.robot.length;i++){
  var rb=s.scanner.robot[i];
  if(rb.active&&rb.team!==s.team){
    var eDist=dst(rb.x,rb.y,450,450);            // [GENE: TARGETING = closest-to-center]
    if(eDist<bestEDist){bestEDist=eDist;enemy=rb;}
  }
}
var eProj=s.scanner.projectile[0]||false;
var prox=s.proximity[0]||false;

var teammate=false;
for(var i=0;i<s.proximity.length;i++){
  var p=s.proximity[i];
  if(p.entityType==='robot'&&p.range<50){         // [GENE: TEAMMATE_DETECT = 50]
    teammate=p;break;
  }
}

var endgame=(r.remaining<15);                      // [GENE: ENDGAME_TRIGGER = 15 seconds]
var finalStand=(r.remaining<5);                    // [GENE: FINAL_STAND_TRIGGER = 5 seconds]

// ═══ PHASE 1: CENTER CONTROL (always active as baseline) ═══
if(dCenter>160){                                   // [GENE: CENTER_FAR = 160]
  a.desiredAngle=toCenter;
  a.desiredForce=s.maxForce*0.9;                   // [GENE: CENTER_FAR_FORCE = 0.9]
  a.desiredScan=120;                               // [GENE: CENTER_FAR_SCAN = 120]
}else if(dCenter>50){                              // [GENE: CENTER_MID = 50]
  a.desiredAngle=toCenter+m.dir*0.3;              // [GENE: CENTER_MID_SWEEP = 0.3]
  a.desiredForce=s.maxForce*0.25;                  // [GENE: CENTER_MID_FORCE = 0.25]
  a.desiredScan=180;                               // [GENE: CENTER_MID_SCAN = 180]
}else{
  a.desiredAngle=myA+m.dir*0.04;                  // [GENE: CENTER_NEAR_SWEEP = 0.04]
  a.desiredForce=s.maxForce*0.03;                  // [GENE: CENTER_NEAR_FORCE = 0.03]
  a.desiredScan=250;                               // [GENE: CENTER_NEAR_SCAN = 250]
  if(m.t%80===0)m.dir=-m.dir;                     // [GENE: DIR_FLIP = 80 frames]
}

if(!endgame){
  // ═══ PHASE 1a: TEAMMATE AVOIDANCE ═══
  if(teammate&&teammate.range<40){                 // [GENE: TEAMMATE_AVOID = 40]
    var awayAngle=(teammate.angleFromRobot+PI)%PI2;
    a.desiredAngle=awayAngle;
    a.desiredForce=s.maxForce*0.5;                 // [GENE: TEAMMATE_FORCE = 0.5]
  }

  // ═══ PHASE 1b: PROJECTILE DODGE ═══
  if(eProj&&eProj.range<120){                     // [GENE: DODGE_RANGE = 120]
    var incoming=(eProj.angleFromRobot+PI)%PI2;
    var pDiff=Math.abs(angDiff(eProj.angle,incoming));
    if(pDiff<0.6){                                 // [GENE: DODGE_THRESHOLD = 0.6]
      var perpL=eProj.angleFromRobot+PI/2;
      var perpR=eProj.angleFromRobot-PI/2;
      var dL=Math.abs(angDiff(perpL,toCenter));
      var dR=Math.abs(angDiff(perpR,toCenter));
      a.desiredAngle=(dL<dR)?perpL:perpR;          // dodge toward center
      a.desiredForce=s.maxForce;
      m.ev=-m.ev;
    }
  }

  // ═══ PHASE 1c: ENGAGE + CENTER-PULL ═══
  if(enemy){
    var range=enemy.range;
    a.desiredScan=clamp(range*0.9,80,350);         // [GENE: SCAN_FACTOR=0.9, MIN=80, MAX=350]

    // Lead calculation
    var projSpeed=55;                               // [GENE: PROJ_SPEED = 55]
    var tF=range/projSpeed;
    var pX=enemy.x+enemy.speed*Math.cos(enemy.angle)*tF;
    var pY=enemy.y+enemy.speed*Math.sin(enemy.angle)*tF;
    var lA=angTo(myX,myY,pX,pY);
    a.desiredAngle=lA;

    var aimErr=Math.abs(angDiff(myA,lA));
    var tgtWidth=Math.atan2(28,range);              // [GENE: TARGET_WIDTH = 28]
    var since=m.t-m.lf;
    if(aimErr<tgtWidth&&since>=30){                // [GENE: FIRE_COOLDOWN = 30]
      a.desiredLaunch=true;
      m.lf=m.t;
      m.ev=-m.ev;
    }

    // CENTER-PULL: force toward center even while aiming at enemy
    if(range<130){                                  // [GENE: RETREAT_RANGE = 130]
      a.desiredForce=-s.maxForce*0.4;              // [GENE: RETREAT_FORCE = 0.4]
    }else if(range>300){                           // [GENE: ADVANCE_RANGE = 300]
      a.desiredForce=s.maxForce*0.5;               // [GENE: ADVANCE_FORCE = 0.5]
    }else if(dCenter>40){                          // [GENE: PULL_THRESHOLD = 40]
      var dotToCenter=Math.cos(angDiff(lA,toCenter));
      if(dotToCenter>0){
        a.desiredForce=s.maxForce*0.25;            // [GENE: PULL_FWD = 0.25]
      }else{
        a.desiredForce=-s.maxForce*0.2;            // [GENE: PULL_REV = 0.2]
      }
    }else{
      a.desiredForce=s.maxForce*0.03;
    }
  }

}else if(!finalStand){
  // ═══ PHASE 2: ENDGAME (15s → 5s) — rush center, dodge, opportunistic fire ═══
  if(dCenter>15){
    a.desiredAngle=toCenter;
    a.desiredForce=s.maxForce;
  }else{
    a.desiredForce=0;
  }
  a.desiredScan=150;

  // Still dodge during endgame (center-biased)
  if(eProj&&eProj.range<100){                     // [GENE: ENDGAME_DODGE_RANGE = 100]
    var incoming=(eProj.angleFromRobot+PI)%PI2;
    var pDiff=Math.abs(angDiff(eProj.angle,incoming));
    if(pDiff<0.5){                                 // [GENE: ENDGAME_DODGE_THRESH = 0.5]
      var perpL=eProj.angleFromRobot+PI/2;
      var perpR=eProj.angleFromRobot-PI/2;
      var dL=Math.abs(angDiff(perpL,toCenter));
      var dR=Math.abs(angDiff(perpR,toCenter));
      a.desiredAngle=(dL<dR)?perpL:perpR;
      a.desiredForce=s.maxForce*0.8;               // [GENE: ENDGAME_DODGE_FORCE = 0.8]
    }
  }

  // Fire if already aimed
  if(enemy){
    var lA2=angTo(myX,myY,enemy.x,enemy.y);
    var aimErr2=Math.abs(angDiff(myA,lA2));
    if(aimErr2<0.15&&(m.t-m.lf)>=30){             // [GENE: ENDGAME_AIM_THRESH = 0.15]
      a.desiredLaunch=true;
      m.lf=m.t;
    }
  }

}else{
  // ═══ PHASE 3: FINAL STAND (last 5s) — park at dead center ═══
  if(dCenter>10){                                  // [GENE: PARK_RADIUS = 10]
    a.desiredAngle=toCenter;
    a.desiredForce=s.maxForce;
  }else{
    a.desiredAngle=false;                          // stop rotating
    a.desiredForce=0;                              // stop moving
  }
}

// ═══ WALL AVOIDANCE (always active, overrides everything) ═══
if(prox&&prox.entityType==='wall'&&prox.range<35){ // [GENE: WALL_PROX = 35]
  a.desiredAngle=toCenter;
  a.desiredForce=s.maxForce;
}
if(myX<55||myX>845||myY<55||myY>845){             // [GENE: WALL_POS = 55]
  a.desiredAngle=toCenter;
  a.desiredForce=s.maxForce;
}
```

### The Genome (All 35 Tunable Parameters)

```
── Center Control ──
CENTER_FAR              = 160     # Threshold to rush toward center
CENTER_FAR_FORCE        = 0.9     # Force multiplier when far
CENTER_FAR_SCAN         = 120     # Scanner range when far
CENTER_MID              = 50      # Threshold for patrol mode
CENTER_MID_SWEEP        = 0.3     # Sweep angle offset
CENTER_MID_FORCE        = 0.25    # Force when patrolling
CENTER_MID_SCAN         = 180     # Scanner range when patrolling
CENTER_NEAR_SWEEP       = 0.04    # Tiny rotation at center
CENTER_NEAR_FORCE       = 0.03    # Minimal drift at center
CENTER_NEAR_SCAN        = 250     # Long-range scan at center
DIR_FLIP                = 80      # Frames between sweep direction change

── Teammate ──
TEAMMATE_DETECT         = 50      # Proximity detection range
TEAMMATE_AVOID          = 40      # Trigger avoidance range
TEAMMATE_FORCE          = 0.5     # Avoidance force

── Dodge ──
DODGE_RANGE             = 120     # Projectile detection range
DODGE_THRESHOLD         = 0.6     # How head-on before dodge triggers

── Engagement ──
TARGETING               = closest-to-center  # Enemy selection strategy
SCAN_FACTOR             = 0.9     # enemy_range × this = scan distance
SCAN_MIN                = 80      # Minimum scan when engaging
SCAN_MAX                = 350     # Maximum scan when engaging
PROJ_SPEED              = 55      # Lead calculation projectile speed
TARGET_WIDTH            = 28      # Aim tolerance (px at target range)
FIRE_COOLDOWN           = 30      # Minimum frames between shots
RETREAT_RANGE           = 130     # Back away if closer than this
RETREAT_FORCE           = 0.4     # Reverse force when retreating
ADVANCE_RANGE           = 300     # Advance if further than this
ADVANCE_FORCE           = 0.5     # Forward force when advancing
PULL_THRESHOLD          = 40      # Center-pull active above this dist
PULL_FWD                = 0.25    # Forward force toward center
PULL_REV                = 0.2     # Reverse force toward center

── Endgame ──
ENDGAME_TRIGGER         = 15      # Seconds remaining to switch mode
ENDGAME_DODGE_RANGE     = 100     # Dodge range during endgame
ENDGAME_DODGE_THRESH    = 0.5     # Dodge threshold during endgame
ENDGAME_DODGE_FORCE     = 0.8     # Dodge force during endgame
ENDGAME_AIM_THRESH      = 0.15    # Fire if aim error below this

── Final Stand ──
FINAL_STAND_TRIGGER     = 5       # Seconds remaining to park
PARK_RADIUS             = 10      # Stop moving within this dist

── Wall Avoidance ──
WALL_PROX               = 35      # Proximity sensor trigger
WALL_POS                = 55      # Position-based trigger (px from edge)
```

---

## WHAT THE CHAMPION LOSES TO (Remaining 16%)

Analysis of the 32 losses in 200 rounds:
- **Sentinel wins 13** — Sentinel occasionally ends up closer to center. This happens when the champion gets pushed by combat during mid-game and doesn't recover in time for endgame.
- **Apex wins 14** — Apex's evasive movement and health-aware retreat sometimes let it survive with better health, and its center-seeking also works.
- **Stinger/fastbot/default win 5** — Rare lucky rounds.

**The remaining losses are almost entirely tiebreaker losses** (both bots survive, but the other lands closer to center at the final frame). Very few rounds end by elimination.

---

## MUTATION STRATEGIES TO TRY

### A. Parameter Mutations (±15-25% on individual genes)

Focus on the genes that directly affect center distance and combat effectiveness:

| Gene | Current | Try Lower | Try Higher | Hypothesis |
|------|---------|-----------|------------|-----------|
| CENTER_FAR | 160 | 130 | 190 | Tighter = closer to center faster |
| CENTER_MID | 50 | 35 | 65 | Affects how tight the center orbit is |
| ENDGAME_TRIGGER | 15 | 12 | 18 | Balance combat time vs center positioning |
| FINAL_STAND_TRIGGER | 5 | 3 | 8 | Earlier parking = closer position but no dodge |
| PROJ_SPEED | 55 | 45 | 65 | Calibrate lead calculation accuracy |
| TARGET_WIDTH | 28 | 22 | 34 | Tighter = fewer but more accurate shots |
| PULL_FWD | 0.25 | 0.15 | 0.35 | Stronger center pull during combat |
| DODGE_RANGE | 120 | 90 | 150 | Less dodge = more center control |

### B. Structural Mutations (new behaviors)

**B1. Rotation-Aware Lead Calculation**
The current lead calc doesn't account for the ~4 frames needed to rotate to aim. Factor rotation time into the prediction:
```javascript
var rotFrames = Math.abs(angDiff(myA, lA)) / 0.272;
var totalT = tF + rotFrames / 60;
var pX = enemy.x + enemy.speed * Math.cos(enemy.angle) * totalT * projSpeed / range * range;
```

**B2. Recoil Compensation**
Each shot applies -0.001 force backward. After firing, apply a compensating `+0.001` force on the next tick to maintain center position. Track `m.fired` flag:
```javascript
if(m.fired){ a.desiredForce = s.maxForce * 0.5; m.fired = 0; }
// ... in fire section:
if(aimErr < tgtWidth && since >= 30){ a.desiredLaunch = true; m.fired = 1; }
```

**B3. Scan Cycling When Idle**
When near center with no enemies detected, alternate between wide (50px) and long (300px) scans every few frames to find enemies faster:
```javascript
if(!enemy && dCenter < 50){
  a.desiredScan = (m.t % 6 < 3) ? 50 : 300;
}
```

**B4. Adaptive Endgame Timing**
Trigger endgame earlier when ahead (high health) and later when behind (need more combat):
```javascript
var egTrigger = (s.health > 50) ? 18 : (s.health > 25) ? 15 : 10;
var endgame = (r.remaining < egTrigger);
```

**B5. Multi-Projectile Dodge**
Currently only dodges the first projectile. Check all projectiles in scanner and dodge the most dangerous one (closest AND heading toward us):
```javascript
var worstProj = false, worstThreat = 0;
for(var i = 0; i < s.scanner.projectile.length; i++){
  var p = s.scanner.projectile[i];
  var inc = (p.angleFromRobot + PI) % PI2;
  var threat = Math.abs(angDiff(p.angle, inc));
  if(p.range < 120 && threat < 0.6 && (1/p.range) > worstThreat){
    worstProj = p; worstThreat = 1/p.range;
  }
}
```

**B6. Health-Aware Aggression**
When health is high (>60%), be more aggressive (wider aim, pursue enemies). When low (<25%), go full defensive (ignore enemies, center-camp only).

**B7. Enemy Count Awareness**
If `r.active <= 3`, switch to pure defensive mode — fewer enemies means less threat, more tiebreaker situations. If `r.active >= 5`, be more aggressive — more chaos, more elimination opportunities.

**B8. Focus Fire (Memory-Based)**
Track which enemy you're engaging in memory. Don't switch targets mid-fight — sustained fire on one enemy is more likely to eliminate them:
```javascript
if(!m.tgt || !enemy || enemy.name !== m.tgt){ m.tgt = enemy ? enemy.name : false; }
// Then prefer the memorized target if still in scanner
```

---

## BENCHMARKING

### Establish Baseline
```bash
cd matterjs-bots && node harness.js --robots apex,sentinel,stinger,default,spinbot,fastbot,champion --rounds 200 --parallel 14 --quiet
```

### Test a Variant
Replace `champion.json` brain code, then run the same command.

### Log Format
```
## Generation N
### Hypothesis: [what you're testing]
### Variants:
- Variant 1: [changes]
- Variant 2: [changes]

### Results (200 rounds each):
| Variant    | 1st | Avg Pl | Health | Accuracy | Dist  |
|------------|-----|--------|--------|----------|-------|
| Baseline K | 168 |   1.47 | 34.1%  |  57.7%   |  42.7 |
| Variant 1  |  ?? |   ?.?? | ??.?%  |  ??.?%   |  ??.? |
| Variant 2  |  ?? |   ?.?? | ??.?%  |  ??.?%   |  ??.? |

### Winner: [variant or "baseline retained"]
### Insight: [what you learned]
```

---

## BOT JSON FORMAT

```json
{
    "id": "champion",
    "key": false,
    "name": "Champion",
    "team": "predators",
    "brain": "var s=context.state,a=context.action,m=context.memory;\n... single-line escaped JS ...",
    "version": 1,
    "updated": "2026-02-28T00:00:00.000Z",
    "oldBrains": []
}
```

**File location:** `matterjs-bots/battle/brains/drivers-ext/champion.json`

To write a brain from a `.js` file to champion.json:
```bash
cat variant.js | node -e "
var fs=require('fs');
var brain=fs.readFileSync('/dev/stdin','utf8').trim();
var json={id:'champion',key:false,name:'Champion',team:'predators',brain:brain,version:1,updated:new Date().toISOString(),oldBrains:[]};
fs.writeFileSync('matterjs-bots/battle/brains/drivers-ext/champion.json',JSON.stringify(json,null,4));
"
```

---

## WHAT ALREADY FAILED (Don't Repeat These)

| Approach | Why It Failed |
|----------|---------------|
| Wider aim tolerance (28→36) | Lost precision, no net improvement |
| Enhanced dodge (range 120→160, threshold 0.6→0.8) | Extra dodging pushed bot from center |
| Reactive damage dodge (check lastDamage) | Same problem — reactive movement = center drift |
| Earlier endgame (20s) | Too much combat time sacrificed |
| Later endgame (12s, via D+) | Not enough time to park at center |
| Coward strategy (orbit 250px, dash late) | Physics too slow to close distance |
| Ultra-tight center (120/40 thresholds) | Hurt accuracy, marginal center improvement |

---

## NOW BEGIN

Run the baseline (200 rounds), then start mutating. Your target is **170+ wins out of 200** (85%+). Focus on the structural mutations (B1-B8) — parameter tuning is showing diminishing returns. Good luck.
