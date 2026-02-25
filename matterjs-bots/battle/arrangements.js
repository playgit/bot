const utils = require("./utils.js");

const circular = (num, cx, cy, xrange, yrange, options) => {
    // circular

    Settings = Object.assign({
        angleOffset: 0, // in rads, default: "natural" (outward) angle
        snapAngle: 0 // in rads, snap rotation
    }, options);

    let positions = [],
        step_angle = Math.PI * 2 / num,
        curr_angle = 0,
        // circle within allowed area of arena
        allowed_min = Math.min(xrange, yrange);

    for (let i=0; i<num; i++) {
        curr_angle += step_angle;
        let vx = Math.cos(curr_angle),
            vy = Math.sin(curr_angle);

        let angle = curr_angle - Settings.angleOffset;
        positions.push([
            cx + vx * (allowed_min / 2),
            cy + vy * (allowed_min / 2),
            (Settings.snapAngle ?
                Math.round(angle/Settings.snapAngle) * Settings.snapAngle
                : angle)
        ]);
    }

    return positions;
}

const raytrace = (num, cx, cy, xrange, yrange, options) => {
    // conform to allowed boundaries

    Settings = Object.assign({
        Sides: [0,1,2,3], // 0 = S, 1 = W, 2 = N, 3 = E
        angleOffset: 0, // in rads, default: "natural" (outward) angle
        snapAngle: 0 // in rads, snap rotation
    }, options);

    let positions = [],
        // bounding box for allowed areas of arena
        arena_x1 = ((cx * 2) - xrange) / 2,
        arena_x2 = arena_x1 + xrange,
        arena_y1 = ((cy * 2) - yrange) / 2,
        arena_y2 = arena_y1 + yrange;

    // angle extent for 4 boundaries of allowed areas
    let dx = arena_x2 - cx,
        dy = arena_y2 - cy,
        // dev: clamp angles for clockwise order, start: south
        abr = utils.clamped_angle(Math.atan2(dy, dx)),
        abl = utils.clamped_angle(Math.atan2(dy, -dx)),
        atr = utils.clamped_angle(Math.atan2(-dy, dx)),
        atl = utils.clamped_angle(Math.atan2(-dy, -dx)),
        angleExtents = [
            [abr, abl, abl - abr], // s
            [abl, atl, atl - abl], // w
            [atl, atr, atr - atl], // n
            [atr, abr + (Math.PI * 2), abr + (Math.PI * 2) - atr]  // e
        ]

    let Angles = [],
        AssignmentOrder = [...Settings.Sides],
        Sides = {};

    if (num < Sides.length) Sides = Sides.slice(0, num);

    // iteratively determine how many robots for each side
    for (let i=0; i<num; i++) {
        let sideID = AssignmentOrder[i % AssignmentOrder.length];
        Sides[sideID] = (Sides[sideID] || 0);
        Sides[sideID]++;
    };

    // mutate variable to add angle offset based on robots per side
    Sides = Object.entries(Sides).map(([id, robots]) => ([
            angleExtents[id][0],
            robots,
            angleExtents[id][2] / (robots + 1),
    ]));

    Sides.forEach(meta => {
        for (let i=0; i<meta[1]; i++) {
            Angles.push(meta[0] + ((i + 1) * meta[2]));
        }
    })

    Angles.forEach((curr_angle)=>{
        wall = utils.closest_edges(cx, cy, curr_angle,
            [arena_x1, arena_y1, arena_x2, arena_y2])[0];

        let angle = curr_angle - Settings.angleOffset;
        positions.push([
            wall[2], wall[3],
            (Settings.snapAngle ?
                Math.round(angle/Settings.snapAngle) * Settings.snapAngle
                : angle)
        ]);
    });

    return positions;
}

module.exports = {
    circular: circular,
    raytrace: raytrace
};
