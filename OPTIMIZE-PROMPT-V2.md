# eBOT FFA Champion Optimization — Session 2

> Continue from Session 1 findings. All stock bots now have UNIQUE teams (true FFA). The team exploit has been fixed.

---

## CRITICAL DISCOVERY FROM SESSION 1

**The original 84% win rate was fake.** Apex, Sentinel, and Stinger were ALL on team "predators" — same as the champion. They never fought each other or the champion. In true FFA (all unique teams), the original champion K only wins **26.5% of rounds** (53/200) and the "default" bot dominates at 44%.

**All optimization must now use unique teams per bot.** Stock bot teams have been fixed:
- apex.json: team "apex"
- sentinel.json: team "sentinel"
- stinger.json: team "stinger"
- default.json: team "default"
- spinbot.json: team "spinbot"
- fastbot.json: team "fastbot"

---

## TRUE FFA BASELINE (200 rounds, all unique teams)

### 7-bot field (with spinbot/fastbot)
| Bot | 1st/200 | Avg Pl | Health | Accuracy | Dist | Life |
|-----|---------|--------|--------|----------|------|------|
| fastbot | 65 | 2.15 | 41.3% | 17.5% | 358.1 | 58.3 |
| Champion K | 53 | 3.73 | 4.8% | 67.1% | 174.3 | 41.0 |
| spinbot | 12 | 3.82 | 21.2% | 13.1% | 447.3 | 48.5 |
| default | 19 | 4.26 | 6.7% | 72.2% | 347.6 | 47.9 |
| Sentinel | 23 | 4.65 | 1.7% | 71.7% | 236.9 | 33.4 |
| Stinger | 10 | 4.68 | 0.7% | 78.6% | 218.8 | 32.5 |
| Apex | 18 | 4.70 | 1.3% | 74.3% | 210.9 | 33.6 |

### 6-bot field (no spinbot/fastbot)
| Bot | 1st/200 | Avg Pl | Health | Accuracy | Dist | Life |
|-----|---------|--------|--------|----------|------|------|
| **default** | **88** | **2.28** | 18.6% | 75.7% | 335.6 | 48.4 |
| KBaseline | 28 | 3.51 | 2.6% | 69.1% | 180.3 | 32.3 |
| G9AChamp | 22 | 3.71 | 1.6% | 69.2% | 196.8 | 28.7 |
| Sentinel | 26 | 3.73 | 2.0% | 72.6% | 205.4 | 32.6 |
| Apex | 26 | 3.83 | 2.6% | 74.3% | 210.9 | 31.6 |
| Stinger | 10 | 3.94 | 0.9% | 78.6% | 199.2 | 29.3 |

---

## WHY DEFAULT BOT WINS

Default's brain is ~30 lines of simple code:
- Random forward movement (50% chance each frame)
- Follows and fires at any enemy in scanner
- Turns away from walls
- Occasional random direction changes

**Why this beats center-camping in FFA:**
1. **Unpredictable movement** — random velocity changes make lead calculation useless
2. **Close-range fire** — only fires when enemy is in scanner = high accuracy (75.7%)
3. **Not a sitting duck** — center-camping bots get hit from all directions in FFA
4. **Survivability** — constant movement + random direction = hard to track

---

## SESSION 1 MUTATIONS TESTED (11 Generations, mirror-match only)

These were tested in champion-vs-champion combat (all variants fight each other). Some findings may still apply:

### Confirmed Improvements (in mirror matches)
| Mutation | Effect | Confidence |
|----------|--------|------------|
| **Scan cycling** | Alternate wide(50)/long(300) scan when idle near center | Moderate — helps find enemies faster |
| **Recoil compensation** | Apply forward thrust after firing to offset recoil | Moderate — keeps center position |
| **Focus fire** | Track target in memory, don't switch mid-fight | High — sustained fire eliminates faster |
| **Velocity-aware braking** | Counter-thrust when drifting away from center | High — better center convergence |
| **Earlier final stand (7s)** | Park at center starting at 7s instead of 5s | High — more time to reach center |
| **PROJ_SPEED=42** | Lead calculation projectile speed (was 55) | Very High — massive accuracy improvement |
| **Dodge force 0.7** | Reduced dodge force from 1.0 to 0.7 | High — less center drift from dodging |

### Confirmed Failures
| Mutation | Effect |
|----------|--------|
| Rotation-aware lead calc | Over-compensated, reduced accuracy |
| Stronger center pull (0.35/0.3) | Made bot too predictable, worse positioning |
| Tighter center thresholds (160→140, 50→45) | Catastrophic — bot dies quickly |
| Tighter parking radius (10→5) | Marginal/negative |
| No dodge during final stand | Negative — takes more damage |
| Faster scan cycling (4-frame) | Negative |
| Closest enemy targeting (vs closest-to-center) | Neutral |
| Adaptive endgame timing (health-based) | Neutral |
| Multi-projectile dodge | Neutral |
| Health-aware aggression | Neutral |
| Enemy count awareness | Negative when passive |
| Endgame lead-calc firing | Neutral |

---

## YOUR MISSION

**Optimize the champion brain for TRUE FFA competition** where all bots are on unique teams. The current baseline is **K with 53/200 wins** (7-bot field) or **28/200** (6-bot field without spinbot/fastbot).

Target: **Beat default's win rate in the 6-bot field** (currently 88/200 = 44%).

### Key Insight: Center-Camping is a Liability in FFA

The entire Variant K strategy revolves around center-camping. In true FFA this means:
- Getting shot from all directions simultaneously
- Being the priority target (closest to center = tiebreaker threat)
- Low health and early death (4.8% health, lifespan 41s in 7-bot field)

**You may need a fundamentally different strategy**, not just parameter tuning on K.

### Strategy Ideas for FFA

**S1. Hit-and-Run (Like Fastbot)**
Fast, evasive movement + fire when opportunities arise. Don't camp center — orbit at ~200px and rush center only in final 10s.

**S2. Kiting / Predator**
Pursue enemies aggressively, maximize kills to reduce field size. Park at center only when 1-2 enemies remain.

**S3. Adaptive Center-Camp**
Keep K's strategy but add much better evasion: spiral movement near center, prioritize dodging over precise aiming, save health for endgame.

**S4. Opportunistic Chameleon**
Early: spread out, fight conservatively, avoid center.
Mid: engage weakened bots.
Late: rush center with remaining health.

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

### Proximity Sensor
- Omnidirectional, ~36px radius (robot maxDimension × 1.5)
- Detects robots and walls regardless of facing direction

### Win Condition & Tiebreakers (IN ORDER)
1. **Last robot alive**
2. **Closest to center** — measured at **final frame only**
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

## CURRENT BEST BRAIN: Variant K-FFA (team-agnostic)

This is the original K brain with team filtering removed. It gets **28/200 wins in 6-bot FFA** (vs sentinel, apex, stinger, default + G9-A variant).

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

// Target closest-to-center enemy — NO team filter
var enemy=false;
var bestEDist=9999;
for(var i=0;i<s.scanner.robot.length;i++){
  var rb=s.scanner.robot[i];
  if(rb.active){
    var eDist=dst(rb.x,rb.y,450,450);
    if(eDist<bestEDist){
      bestEDist=eDist;
      enemy=rb;
    }
  }
}
var eProj=s.scanner.projectile[0]||false;
var prox=s.proximity[0]||false;

var endgame=(r.remaining<15);
var finalStand=(r.remaining<5);

if(dCenter>160){
  a.desiredAngle=toCenter;
  a.desiredForce=s.maxForce*0.9;
  a.desiredScan=120;
}else if(dCenter>50){
  a.desiredAngle=toCenter+m.dir*0.3;
  a.desiredForce=s.maxForce*0.25;
  a.desiredScan=180;
}else{
  a.desiredAngle=myA+m.dir*0.04;
  a.desiredForce=s.maxForce*0.03;
  a.desiredScan=250;
  if(m.t%80===0)m.dir=-m.dir;
}

if(!endgame){
  if(eProj&&eProj.range<120){
    var incoming=(eProj.angleFromRobot+PI)%PI2;
    var pDiff=Math.abs(angDiff(eProj.angle,incoming));
    if(pDiff<0.6){
      var perpL=eProj.angleFromRobot+PI/2;
      var perpR=eProj.angleFromRobot-PI/2;
      var dL=Math.abs(angDiff(perpL,toCenter));
      var dR=Math.abs(angDiff(perpR,toCenter));
      a.desiredAngle=(dL<dR)?perpL:perpR;
      a.desiredForce=s.maxForce;
      m.ev=-m.ev;
    }
  }

  if(enemy){
    var range=enemy.range;
    a.desiredScan=clamp(range*0.9,80,350);
    var projSpeed=55;
    var tF=range/projSpeed;
    var pX=enemy.x+enemy.speed*Math.cos(enemy.angle)*tF;
    var pY=enemy.y+enemy.speed*Math.sin(enemy.angle)*tF;
    var lA=angTo(myX,myY,pX,pY);
    a.desiredAngle=lA;
    var aimErr=Math.abs(angDiff(myA,lA));
    var tgtWidth=Math.atan2(28,range);
    var since=m.t-m.lf;
    if(aimErr<tgtWidth&&since>=30){
      a.desiredLaunch=true;
      m.lf=m.t;
      m.ev=-m.ev;
    }
    if(range<130){
      a.desiredForce=-s.maxForce*0.4;
    }else if(range>300){
      a.desiredForce=s.maxForce*0.5;
    }else if(dCenter>40){
      var dotToCenter=Math.cos(angDiff(lA,toCenter));
      if(dotToCenter>0){
        a.desiredForce=s.maxForce*0.25;
      }else{
        a.desiredForce=-s.maxForce*0.2;
      }
    }else{
      a.desiredForce=s.maxForce*0.03;
    }
  }
}else if(!finalStand){
  if(dCenter>15){
    a.desiredAngle=toCenter;
    a.desiredForce=s.maxForce;
  }else{
    a.desiredForce=0;
  }
  a.desiredScan=150;

  if(eProj&&eProj.range<100){
    var incoming=(eProj.angleFromRobot+PI)%PI2;
    var pDiff=Math.abs(angDiff(eProj.angle,incoming));
    if(pDiff<0.5){
      var perpL=eProj.angleFromRobot+PI/2;
      var perpR=eProj.angleFromRobot-PI/2;
      var dL=Math.abs(angDiff(perpL,toCenter));
      var dR=Math.abs(angDiff(perpR,toCenter));
      a.desiredAngle=(dL<dR)?perpL:perpR;
      a.desiredForce=s.maxForce*0.8;
    }
  }

  if(enemy){
    var lA2=angTo(myX,myY,enemy.x,enemy.y);
    var aimErr2=Math.abs(angDiff(myA,lA2));
    if(aimErr2<0.15&&(m.t-m.lf)>=30){
      a.desiredLaunch=true;
      m.lf=m.t;
    }
  }
}else{
  if(dCenter>10){
    a.desiredAngle=toCenter;
    a.desiredForce=s.maxForce;
  }else{
    a.desiredAngle=false;
    a.desiredForce=0;
  }
}

if(prox&&prox.entityType==='wall'&&prox.range<35){
  a.desiredAngle=toCenter;
  a.desiredForce=s.maxForce;
}
if(myX<55||myX>845||myY<55||myY>845){
  a.desiredAngle=toCenter;
  a.desiredForce=s.maxForce;
}
```

---

## G9-A VARIANT (All Session 1 Improvements Applied)

Gets 22/200 in 6-bot FFA. Better in mirror matches but slightly worse vs diverse opponents.

Changes from K:
- No team filter (targets all robots)
- No teammate avoidance
- Scan cycling (alternate 50/300 when idle near center)
- Recoil compensation (forward thrust after firing)
- Focus fire (memory-based target tracking)
- Velocity-aware center braking
- Earlier final stand (7s vs 5s)
- PROJ_SPEED=42 (was 55)
- Dodge force 0.7 (was 1.0)

File: `variant-ffa-brain.js`

---

## BENCHMARKING

### Command
```bash
cd matterjs-bots && node harness.js --robots apex,sentinel,stinger,default,champion --rounds 100 --parallel 14 --quiet
```

Drop spinbot/fastbot for cleaner competition. Use **100 rounds** (not 200) for faster iteration.

### Create Bot from JS File
```bash
BRAIN=$(cat your-variant.js) BOTID="yourid" BOTNAME="YourName" node -e "
var fs=require('fs');
var brain=process.env.BRAIN;
var json={id:process.env.BOTID,key:false,name:process.env.BOTNAME,team:process.env.BOTID,brain:brain,version:1,updated:new Date().toISOString(),oldBrains:[]};
fs.writeFileSync('matterjs-bots/battle/brains/drivers-ext/'+process.env.BOTID+'.json',JSON.stringify(json,null,4));
"
```

### Champion vs Variants (mirror match)
```bash
node harness.js --robots champion,variant1,variant2,variant3 --rounds 100 --parallel 14 --quiet
```

Each bot MUST have a unique team in the JSON file.

---

## BOT JSON FORMAT

```json
{
    "id": "champion",
    "key": false,
    "name": "Champion",
    "team": "champion",
    "brain": "var s=context.state... (single-line JS string)",
    "version": 1,
    "updated": "2026-02-28T00:00:00.000Z",
    "oldBrains": []
}
```

**File location:** `matterjs-bots/battle/brains/drivers-ext/champion.json`

---

## WHAT NOT TO TRY (Already Failed)

| Approach | Why It Failed |
|----------|---------------|
| Wider aim tolerance (28→36) | Lost precision |
| Enhanced dodge (range 120→160, threshold 0.6→0.8) | Pushed bot from center |
| Reactive damage dodge | Center drift |
| Earlier endgame (20s) | Too much combat time lost |
| Later endgame (12s) | Not enough parking time |
| Coward strategy (orbit 250px, dash late) | Physics too slow |
| Ultra-tight center (120/40 thresholds) | Bot dies quickly |
| Rotation-aware lead calc | Over-compensated |
| Stronger center pull (0.35/0.3) | Made bot predictable |
| Tighter parking radius (10→5) | Marginal/negative |
| No dodge during final stand | Takes more damage |
| Faster scan cycling (4-frame) | Negative |
| Closest enemy targeting | Neutral |
| Adaptive endgame timing (health-based) | Neutral |
| Multi-projectile dodge | Neutral |
| Health-aware aggression | Neutral |
| Enemy count awareness | Negative when passive |

---

## RULES REMINDER

- The bot brain must be a single JavaScript string in a JSON file (VM2 sandbox, 500ms timeout)
- Memory limited to 1000 chars JSON-serialized
- Variables: `var` only (no `let`/`const`). No arrow functions.
- **ALL bots must have unique teams** (true FFA)
- The bot under test goes in `matterjs-bots/battle/brains/drivers-ext/champion.json`

## NOW BEGIN

Run the K-FFA brain as baseline (100 rounds, 5-bot field: apex,sentinel,stinger,default,champion), then start designing a strategy that beats default's dominance in true FFA. The center-camping meta is broken — you need a new approach.
