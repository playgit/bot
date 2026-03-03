// ============================================================================
// CHAMPION BOT — "Kite & Conquer" (DDv8)
// ============================================================================
//
// Win rates:  85% in 5-bot FFA  |  77% in 7-bot FFA
//
// CORE INSIGHT: Proximity-based robot avoidance creates natural kiting.
// The bot moves randomly like default (hard to hit), but retreats from any
// robot that gets within 55px. This prevents close-range brawls where most
// damage is dealt. The result: 38% health remaining vs 5.8% for the old
// center-camping champion.
//
// THREE PHASES:
//   1. Main (>12s left)  — Random movement + lead-calc firing + kite away
//   2. Endgame (12-5s)   — Rush center, fire opportunistically, still kite
//   3. Final (<5s)        — Park at center, dodge only if robot too close
//
// KEY PARAMETERS (empirically tuned):
//   - Proximity dodge range: 55px (wider = more avoidance = more survival)
//   - Projectile speed for lead calc: 42 px/frame (calibrated in Session 1)
//   - Endgame start: 12 seconds remaining
//   - Final park: 5 seconds remaining
//   - Fire cooldown: 30 frames (engine minimum, 0.5 shots/sec)
// ============================================================================

// --- DEFAULT-LIKE RANDOM MOVEMENT ---
// 50% chance of forward thrust each frame. This stutter-step is the single
// most important survival mechanic: random velocity changes make the bot
// nearly impossible to lead-track. Removing this (always-on thrust) was
// tested and HALVED lifespan.
if (Math.random() < 0.5) {
    context.action.desiredForce = context.state.maxForce;
}

// --- SHORTHAND ALIASES ---
var s = context.state, a = context.action, m = context.memory;
var PI = Math.PI, PI2 = PI * 2;

// --- PERSISTENT MEMORY ---
// m.t  = frame counter (used for fire cooldown timing)
// m.lf = last frame we fired (starts at -99 so first shot is immediate)
if (!m.t) { m.t = 0; m.lf = -99; }
m.t++;

// --- UTILITY: Signed angle difference (clamped to [-PI, PI]) ---
var angDiff = function(x, y) {
    var d = (x - y) % PI2;
    if (d > PI) d -= PI2;
    if (d < -PI) d += PI2;
    return d;
};

// --- SENSOR READS ---
var closest = s.proximity[0] || {};                   // nearest entity in omnidirectional proximity
var front   = s.scanner.robot[0] || false;            // first robot in forward scanner cone
var eProj   = s.scanner.projectile[0] || false;       // first projectile in scanner
var rem     = context.round.remaining;                // seconds left in round

// --- POSITION ---
var myX = s.position.x, myY = s.position.y, myA = s.angle;
var dC  = Math.sqrt((myX - 450) * (myX - 450) + (myY - 450) * (myY - 450));  // distance to arena center
var toC = s.angleToCenter;                            // absolute angle toward center

// --- PROXIMITY ROBOT DETECTION ---
// Scan ALL proximity entries for any robot within 55px.
// This is the CORE MECHANIC: if a robot is this close, we kite away.
// 55px was the sweet spot — 40px was too tight (less avoidance),
// 60px was slightly too aggressive (interfered with firing).
var nearbot = false;
for (var j = 0; j < s.proximity.length; j++) {
    var p = s.proximity[j];
    if (p.entityType === 'robot' && p.range < 55) {
        nearbot = p;
        break;
    }
}

// ============================================================================
// PHASE 1: FINAL STAND (< 5 seconds remaining)
// ============================================================================
// Rush to center and park. The #1 tiebreaker for alive bots is distance
// to center at the FINAL FRAME, so being at (450,450) is critical.
// Proximity dodge is still active — if a robot bumps us at center,
// we briefly dodge then return.
if (rem < 5) {
    if (dC > 8) {
        a.desiredAngle = toC;
        a.desiredForce = s.maxForce;
    } else {
        a.desiredForce = 0;               // at center, stop moving
    }
    // Override: dodge nearby robot even during final park
    if (nearbot) {
        a.desiredAngle = (nearbot.angleFromRobot + PI) % PI2;  // face AWAY
        a.desiredForce = s.maxForce * 0.5;
    }
}

// ============================================================================
// PHASE 2: ENDGAME (12-5 seconds remaining)
// ============================================================================
// Rush toward center at full speed. Fire at enemies opportunistically
// using lead calculation, but ONLY if no robot is dangerously close.
// Proximity dodge overrides the rush if needed to avoid collision damage.
else if (rem < 12) {
    a.desiredAngle = toC;
    a.desiredForce = s.maxForce;

    // Fire with lead calc during rush (only when safe from close robots)
    if (front && front.active && front.team != s.team && !nearbot) {
        var r2  = front.range;
        var ps  = 42;                     // empirical projectile speed (px/frame)
        var tF2 = r2 / ps;               // time-of-flight in frames
        // Predict where enemy will be when projectile arrives
        var lx = front.x + front.speed * Math.cos(front.angle) * tF2;
        var ly = front.y + front.speed * Math.sin(front.angle) * tF2;
        var lA = Math.atan2(ly - myY, lx - myX);   // lead angle
        var ae = Math.abs(angDiff(myA, lA));
        // Fire if we're aimed within the target's angular width AND cooldown ready
        if (ae < Math.atan2(28, r2) && (m.t - m.lf) >= 30) {
            a.desiredLaunch = true;
            m.lf = m.t;
        }
    }

    // Override: dodge nearby robot during endgame rush
    if (nearbot) {
        a.desiredAngle = (nearbot.angleFromRobot + PI) % PI2;
        a.desiredForce = s.maxForce * 0.5;
    }
}

// ============================================================================
// PHASE 3: MAIN COMBAT (> 12 seconds remaining)
// ============================================================================
// This is where the bot spends most of its time. Priority cascade:
//   Wall avoidance > Enemy engagement > Random wander
// The proximity dodge (at the bottom) overrides ALL of these.

// --- WALL AVOIDANCE (highest priority in main phase) ---
else if (closest.entityType == "wall") {
    a.desiredAngle = toC;                 // face center to escape wall
}

// --- ENEMY ENGAGEMENT ---
else if (front) {
    if (front.active && front.team != s.team) {
        // Active enemy in scanner — engage with lead calculation
        // BUT only if no robot is dangerously close (nearbot check)
        if (!nearbot) {
            var r1  = front.range;
            var ps1 = 42;                 // projectile speed
            var tF1 = r1 / ps1;          // time of flight
            // Lead prediction: where will enemy be when bullet arrives?
            var lx1 = front.x + front.speed * Math.cos(front.angle) * tF1;
            var ly1 = front.y + front.speed * Math.sin(front.angle) * tF1;
            var lA1 = Math.atan2(ly1 - myY, lx1 - myX);

            a.desiredAngle = lA1;         // face the lead point

            var ae1 = Math.abs(angDiff(myA, lA1));
            // Fire when aim error is less than target's angular width
            // atan2(28, range) ≈ angular size of a ~28px wide target at given range
            if (ae1 < Math.atan2(28, r1) && (m.t - m.lf) >= 30) {
                a.desiredLaunch = true;
                m.lf = m.t;              // record last fire frame
            }
        }
        // If nearbot is true, we DON'T fire — the proximity dodge below
        // will override our facing direction anyway, wasting the shot.
        // This "don't fire when close" saves accuracy and reduces recoil.
    } else {
        // Inactive robot or same team — turn away slightly (from default bot)
        var dir2 = (front.angleFromRobot - s.angle) < 0 ? -1 : 1;
        a.desiredAngle = s.angle - (dir2 * 0.174533);   // ~10 degrees away
        a.desiredForce = s.maxForce / 2;
    }
}

// --- RANDOM WANDER (no enemies visible) ---
// 0.5% chance per frame of a random direction change (±45°).
// This is identical to default bot. The random movement makes the bot
// extremely hard to predict and track with lead calculations.
else if (Math.random() < 0.005) {
    var maxvar = PI / 4;
    a.desiredAngle = s.angle + (Math.random() * maxvar) - maxvar / 2;
    a.desiredForce = 0;                   // tight turn, no thrust
}

// ============================================================================
// PROJECTILE DODGE (only when no robot is nearby)
// ============================================================================
// If a projectile is within 100px and heading roughly toward us, dodge
// perpendicular to its path. We choose the perpendicular direction that
// takes us closer to center (preserving positioning).
// This is SKIPPED when nearbot is true — robot avoidance takes priority
// because close robots deal collision damage AND concentrated fire.
if (!nearbot && eProj && eProj.range < 100) {
    var inc = (eProj.angleFromRobot + PI) % PI2;      // angle FROM projectile TO us
    var pD  = Math.abs(angDiff(eProj.angle, inc));     // how "head-on" is it?
    if (pD < 0.5) {                                     // within ~28° of head-on
        var pL = eProj.angleFromRobot + PI / 2;        // perpendicular left
        var pR = eProj.angleFromRobot - PI / 2;        // perpendicular right
        // Pick the direction closer to center
        var dL = Math.abs(angDiff(pL, toC));
        var dR = Math.abs(angDiff(pR, toC));
        a.desiredAngle = (dL < dR) ? pL : pR;
        a.desiredForce = s.maxForce * 0.6;
    }
}

// ============================================================================
// PROXIMITY ROBOT DODGE — THE KEY INNOVATION (overrides everything above)
// ============================================================================
// If ANY robot is within 55px, face directly AWAY and push back.
// This runs LAST so it overrides all other desiredAngle/desiredForce.
//
// WHY THIS WORKS:
//   1. Prevents robot collision damage (2 HP each)
//   2. Creates distance from close-range fire (where accuracy is highest)
//   3. Naturally produces kiting behavior: fire at range → retreat when close
//   4. The retreat direction is unpredictable (depends on enemy approach angle)
//   5. Combined with random movement, creates chaotic evasion patterns
//
// NOT active during final stand (<5s) — that's handled above with its
// own nearbot check so we don't flee from center in the last moments.
if (nearbot && rem >= 5) {
    a.desiredAngle = (nearbot.angleFromRobot + PI) % PI2;   // face AWAY from robot
    a.desiredForce = s.maxForce * 0.5;                       // moderate retreat speed
}
