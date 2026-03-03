// =======================
// Bot Arena Fight - Updated (3-bot + anti-rush + better evasion)
// Winner: closest to center with least damage
// =======================

var s = context.state, a = context.action, m = context.memory;
var PI = Math.PI, PI2 = PI * 2;

// ---------- init ----------
if (!m.t) { m.t = 0; m.lf = -99; }
m.t++;

if (m.orbDir === undefined) m.orbDir = (Math.random() < 0.5 ? -1 : 1);
if (!m.lastRange) m.lastRange = {};        // enemy id -> last range
if (m.evadeUntil === undefined) m.evadeUntil = 0;
if (m.lastDamageFrame === undefined) m.lastDamageFrame = -9999;

// ---------- helpers ----------
var angDiff = function(x, y) {
  var d = (x - y) % PI2;
  if (d > PI) d -= PI2;
  if (d < -PI) d += PI2;
  return d;
};
var clamp = function(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); };

// ---------- safe remaining time ----------
var rem =
  (context.round && typeof context.round.remaining === "number") ? context.round.remaining :
  (typeof context.remaining === "number") ? context.remaining :
  30;

// ---------- local state ----------
var closest = s.proximity[0] || {};
var front   = s.scanner.robot[0] || false;
var eProj   = s.scanner.projectile[0] || false;

var myX = s.position.x, myY = s.position.y, myA = s.angle;
var cx = 450, cy = 450;
var dxC = myX - cx, dyC = myY - cy;
var dC  = Math.sqrt(dxC * dxC + dyC * dyC);
var toC = s.angleToCenter;

var hp = (typeof s.health === "number") ? s.health : 100;
var lowHP = hp < 35;

// ---------- random micro-jitter (reduced; helps not be perfectly predictable) ----------
if (Math.random() < 0.002) {
  a.desiredAngle = s.angle + (Math.random() * (PI/10)) - (PI/20);
  a.desiredForce = 0;
}

// ---------- detect nearest enemy + counts ----------
var nearbot = false;
var nearestEnemy = null, nearestEnemyRange = 1e9;
var enemyNearCount = 0;

for (var j = 0; j < s.proximity.length; j++) {
  var p = s.proximity[j];
  if (p.entityType !== "robot") continue;
  if (!p.active) continue;
  if (p.team === s.team) continue;

  if (p.range < 55 && !nearbot) nearbot = p;
  if (p.range < 90) enemyNearCount++;
  if (p.range < nearestEnemyRange) { nearestEnemyRange = p.range; nearestEnemy = p; }
}

// ---------- ring-control targets (beats last-second rush) ----------
var ringTarget =
  (rem < 9)  ? 55  :
  (rem < 16) ? 120 :
              210;

var ringErr = dC - ringTarget;

// ---------- orbiting default (stable, low-collision) ----------
var orbitAngle = toC + m.orbDir * (PI / 2);
a.desiredAngle = orbitAngle;

// base force scales with ring error
var base = clamp(Math.abs(ringErr) / 140, 0.15, 1.0);
a.desiredForce = s.maxForce * base;

// radial correction
if (ringErr > 25) {
  a.desiredAngle = toC;
  a.desiredForce = s.maxForce * clamp(ringErr / 220, 0.35, 1.0);
} else if (ringErr < -25) {
  a.desiredAngle = (toC + PI) % PI2;
  a.desiredForce = s.maxForce * clamp((-ringErr) / 220, 0.25, 0.75);
}

// ---------- wall safety ----------
if (closest.entityType === "wall") {
  a.desiredAngle = toC + m.orbDir * (PI / 6);
  a.desiredForce = s.maxForce * 0.9;
}

// ---------- projectile dodge (ring-aware) ----------
if (!nearbot && eProj && eProj.range < 110) {
  var inc = (eProj.angleFromRobot + PI) % PI2;
  var pD  = Math.abs(angDiff(eProj.angle, inc));
  if (pD < 0.55) {
    var pL = eProj.angleFromRobot + PI / 2;
    var pR = eProj.angleFromRobot - PI / 2;

    var testLx = myX + Math.cos(pL) * 40, testLy = myY + Math.sin(pL) * 40;
    var testRx = myX + Math.cos(pR) * 40, testRy = myY + Math.sin(pR) * 40;
    var dCL = Math.sqrt((testLx - cx)*(testLx - cx) + (testLy - cy)*(testLy - cy));
    var dCR = Math.sqrt((testRx - cx)*(testRx - cx) + (testRy - cy)*(testRy - cy));
    var errL = Math.abs(dCL - ringTarget);
    var errR = Math.abs(dCR - ringTarget);

    a.desiredAngle = (errL < errR) ? pL : pR;
    a.desiredForce = s.maxForce * 0.65;
  }
}

// ---------- damage panic (break pins) ----------
var justDamaged = false;
if (s.lastDamage && s.lastDamage.length) {
  var ld = s.lastDamage[s.lastDamage.length - 1];
  if (ld.atFrame !== m.lastDamageFrame) {
    m.lastDamageFrame = ld.atFrame;
    justDamaged = true;
  }
}
if (justDamaged) {
  m.evadeUntil = m.t + 14;
  m.orbDir *= -1;
}

// ---------- wall risk estimator (for strafing choice) ----------
var wallRisk = function(ang) {
  var nx = myX + Math.cos(ang) * 60;
  var ny = myY + Math.sin(ang) * 60;

  // Conservative bounds (arena seems ~0..900; sample walls at -5)
  var left   = Math.max(0, 25 - nx);
  var right  = Math.max(0, nx - 875);
  var top    = Math.max(0, 25 - ny);
  var bottom = Math.max(0, ny - 875);
  return left*left + right*right + top*top + bottom*bottom;
};

// ---------- aggressive bot awareness (closing speed) ----------
var closing = 0;
if (nearestEnemy) {
  var prev = m.lastRange[nearestEnemy.id];
  if (typeof prev === "number") closing = prev - nearestEnemy.range; // >0 => approaching
  m.lastRange[nearestEnemy.id] = nearestEnemy.range;
}

var closeThreat = nearestEnemy && nearestEnemyRange < 65;
var chaseThreat = nearestEnemy && nearestEnemyRange < 140 && closing > 0.8;
var evade = (m.t < m.evadeUntil) || closeThreat || chaseThreat;

// ---------- evasion: strafe + wall-aware ----------
if (evade && nearestEnemy) {
  var leftStrafe  = nearestEnemy.angleFromRobot + PI / 2;
  var rightStrafe = nearestEnemy.angleFromRobot - PI / 2;

  var riskL = wallRisk(leftStrafe);
  var riskR = wallRisk(rightStrafe);
  var strafe = (riskL < riskR) ? leftStrafe : rightStrafe;

  var away = (nearestEnemy.angleFromRobot + PI) % PI2;

  // very close: bias to away/quick-turn so we don't eat a ram
  if (nearestEnemyRange < 45) {
    strafe = (Math.abs(angDiff(myA, strafe)) < Math.abs(angDiff(myA, away))) ? strafe : away;
  }

  var wallIsClosest = (closest && closest.entityType === "wall" && closest.range < 55);
  var f = s.maxForce * (nearestEnemyRange < 70 ? 1.0 : 0.85);
  if (wallIsClosest) f = s.maxForce * 0.75;

  a.desiredAngle = strafe;
  a.desiredForce = f;

  // deterrent shot if lined up and not in immediate ram range
  if (front && front.active && front.team != s.team && nearestEnemyRange < 140 && (m.t - m.lf) >= 28) {
    var aeDet = Math.abs(angDiff(myA, front.angleFromRobot));
    if (aeDet < 0.22) { a.desiredLaunch = true; m.lf = m.t; }
  }
}

// ---------- disengage logic (avoid "fight to death" in 3-bot chaos) ----------
var risky = lowHP || (enemyNearCount >= 2 && rem > 6);
if (nearestEnemy && risky && !evade) {
  var away2 = (nearestEnemy.angleFromRobot + PI) % PI2;
  a.desiredAngle = away2 + m.orbDir * (PI / 6);
  a.desiredForce = s.maxForce * 0.85;
}

// ---------- shooting with lead + anti-rush punish ----------
if (front && front.active && front.team != s.team) {
  var r = front.range;

  // lead
  var ps = 42;
  var tF = r / ps;
  var lx = front.x + front.speed * Math.cos(front.angle) * tF;
  var ly = front.y + front.speed * Math.sin(front.angle) * tF;
  var lA = Math.atan2(ly - myY, lx - myX);

  // aim only if not heavily evading / not risky
  if (!evade && !risky && !nearbot) a.desiredAngle = lA;

  // detect "rusher toward center" late game
  var ex = front.x - cx, ey = front.y - cy;
  var enemyDC = Math.sqrt(ex*ex + ey*ey);
  var enemyToC = Math.atan2(cy - front.y, cx - front.x);
  var enemyHeadingToCenter = Math.abs(angDiff(front.angle, enemyToC)) < 0.55;

  var late = rem < 9;
  var punishRusher = late && enemyHeadingToCenter && enemyDC > 35;

  var ae = Math.abs(angDiff(myA, lA));
  var tol = Math.atan2(28, r) + (punishRusher ? 0.12 : 0.0);

  if (!nearbot && (m.t - m.lf) >= 28) {
    if (!lowHP || punishRusher) {
      if (ae < tol) {
        a.desiredLaunch = true;
        m.lf = m.t;
      }
    }
  }
}

// ---------- close-quarters collision avoidance (sidestep, don't reverse) ----------
if (nearbot && rem >= 3.5) {
  a.desiredAngle = (nearbot.angleFromRobot + m.orbDir * (PI / 2)) % PI2;
  a.desiredForce = s.maxForce * 0.7;
}

// ---------- endgame: take/hold center (but avoid last-second ram) ----------
if (rem < 3.5) {
  if (dC > 10) {
    a.desiredAngle = toC;
    a.desiredForce = s.maxForce;
  } else {
    a.desiredForce = 0;
  }

  if (nearestEnemy && nearestEnemyRange < 70) {
    a.desiredAngle = toC + m.orbDir * (PI / 2);
    a.desiredForce = s.maxForce * 0.55;
  }
}