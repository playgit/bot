/*
    state
    action
    memory
    debug
*/

var behaviours = Object.assign({
    randomForward   : 0.5,
    randomHeading   : 0.005,
    scanFire        : true
}, context.debug || {});

// use supplied pseudo-random number generator when available
// results in deterministic behaviours
let randfunc = context.debug.PRNG || Math.random,
    randval = randfunc();
// track calling sequence and randomness
context.debug.rand = [
    randfunc == Math.random ? "builtin" : "custom",
    randval,
    context.state.name,
    context.state.id ];

// randomly move forward
if (behaviours.randomForward && randval < behaviours.randomForward) {
    context.action.desiredForce = context.state.maxForce;
}

// detect closest entity via (short range) proximity alerts
var closest = context.state.proximity[0] || {};

// detect robot entity in front of robot via (short-medium range) scanner
var front = context.state.scanner.robot[0] || false;

if (closest.entityType == "wall") {
    // face robot towards center of arena if too close to wall
    context.action.desiredAngle = context.state.angleToCenter;
} else if (front) {
    if (front.active && front.team != context.state.team) {
        // follow active enemy robots
        context.action.desiredAngle = (
            context.state.angle - (context.state.angle - front.angleFromRobot));
        if (behaviours.scanFire) context.action.desiredLaunch = true;
    } else {
        // avoid inactive robots
        dir = (front.angleFromRobot - context.state.angle) < 0 ? -1:1;
        context.action.desiredAngle = context.state.angle - (dir * 0.174533);
        context.action.desiredForce = context.state.maxForce / 2;
    }
} else if (behaviours.randomHeading && randval < behaviours.randomHeading) {
    // face random direction
    var maxvar = Math.PI / 4, // 45 degrees
        random = (randval * maxvar) - maxvar/2; // left or right
        context.action.desiredAngle = context.state.angle + random;
        context.action.desiredForce = 0; // tight turn
}
