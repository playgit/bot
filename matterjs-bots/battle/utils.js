const rad_deg = (angle, rounding) => {
    var degrees = angle * 180 / Math.PI;
    if (rounding) {
        rounding = Math.pow(10, rounding);
        degrees = Math.round(degrees * rounding) / rounding;
    }
    return degrees;
}

const clamped_angle = (angle, rounding) => {
    // restrict angle (radians) to [0, 6.28319] (360 degrees)
    // IMPORTANT: canvas angle: +ve angle is clockwise
    // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/rotate

    var maxrads = Math.PI * 2;
    while (angle < 0) angle += maxrads;
    angle = angle % maxrads;
    if (rounding) {
        rounding = Math.pow(10, rounding);
        angle = Math.round(angle * rounding) / rounding;
    }
    return angle;
};

const abs_bearing = (angle, rounding) => {
    // returns bearing in degrees
    // 0=NORTH, 90=E, 180=S, 270=W

    angle = clamped_angle(angle);
    degrees = 90 + rad_deg(angle);
    while (degrees < 0) degrees += 360;
    degrees = degrees % 360;
    if (rounding) {
        rounding = Math.pow(10, rounding);
        degrees = Math.round(degrees * rounding) / rounding;
    }
    return degrees;
};

const angle_to = (x1, y1, x2, y2) => {
    // angle from x1, y1 to x2, y2

    let dx = x2 - x1,
        dy = y2 - y1,
        rads = Math.atan2(dy, dx);
    return rads;
};

const closest_edges = (x, y, angle, bbox) => {
    // distance to intersecting bounding box edges
    // returns list, closest edge first
    // dev: canvas has inverted y-axis: top-left y > bottom-right y

    // https://stackoverflow.com/a/3197924
    var vx = Math.cos(angle),
        vy = Math.sin(angle)
        tests = [
            // top-left
            [(bbox[0]-x)/vx, "west"],
            [(bbox[2]-x)/vx, "east"],
            // bottom-right
            [(bbox[1]-y)/vy, "south"],
            [(bbox[3]-y)/vy, "north"]
        ].filter(t => isFinite(t[0]) && t[0] > 0.0)
         .sort((a, b) => a[0] > b[0] ? 1 : -1);

    if (tests.length == 0) return false;

    return tests.map(t => [t[1], t[0], x + (vx * t[0]), y + (vy * t[0])]);
}

const assign_keys = (keys, target, source) => {
    // merges source sub-dict with target sub-dict at keys
    //  target.[test].xyz = "1" (+)
    //  source.[test].abc = "2" (=)
    //  target.[text].xyz = "1"
    //  target.[text].abc = "2"
    for (let key of keys) {
        let merge = source[key] || {};
        if (typeof(merge) !== "object") throw "options." + key;
        target[key] = Object.assign(target[key], merge);
    }
}

const shuffleArray = (array) => {
    return array.map((a) => [Math.random(),a]).sort((a,b) => a[0]-b[0]).map((a) => a[1]);
}

const roundTo = (num, mult) => Math.round(num * mult) / mult;

/* sort helper: orderBy (subproperty, subindex)
    * accepts multiple argument for sort
    * sorts smallest to largest, reverse with '-' prefix

ref: https://stackoverflow.com/a/4760279 */
function orderBy () {
    const _sort = (property) => {
        var sortOrder = 1;
        if(property[0] === "-") {
            sortOrder = -1;
            property = property.substr(1);
        }
        return function (a,b) {
            var result =
                (a[property] < b[property]) ? -1 :
                (a[property] > b[property]) ?  1 : 0;

            return result * sortOrder;
        }
    };

    var props = arguments;
    return (obj1, obj2) => {
        var i = 0, result = 0, numberOfProperties = props.length;
        while(result === 0 && i < numberOfProperties) {
            result = _sort(props[i])(obj1, obj2);
            i++;
        }
        return result;
    }
}

/* vertex and state serialisers
    dev: short-forms used to conserve socket bandwidth */

const GenericVertexes = e => ({
    // [ed]ges
    // [ce]nter
    // [an]gle
    // [m]ax[D]imension
    // [F]ill[Style]
    id: e.id,
    ed: e.vertices.map(({x, y}) => ({
        x: roundTo(x, 10),
        y: roundTo(y, 10) })),
    ce: [roundTo(e.position.x, 10),
            roundTo(e.position.y, 10)],
    an: roundTo(clamped_angle(e.angle), 100),
    mD: e.maxDimension || false,
    // FS: e.render.fillStyle,
});

const Damage = d => ({
    // [d]amage[t]ype]
    // [o]rigin[I]D
    'dt': d.type,
    'oI': d.origin.id,
});

const ScanRanges = e => ({
    // [r]obot[i]d
    // [ed]ges
    // [ce]nter
    // [an]gle
    // [m]ax[D]imension
    // [s]can[D]istance
    // [F]ill[Style]
    id: e.id,
    ri: e.refidRobot,
    ed: e.vertices.map(({x, y}) => ({
        x: roundTo(x, 10),
        y: roundTo(y, 10) })),
    ce: [roundTo(e.position.x, 10),
            roundTo(e.position.y, 10)],
    an: roundTo(clamped_angle(e.angle), 100),
    sD: e.scanDistance,
    // FS: e.render.fillStyle,
});

const Robots = (e, arena) => ({
    // [ce]nter
    // [an]gle
    // [e]ntity[W]idth
    // [e]ntity[H]eight
    // [m]ax[D]imension
    // [ac]tive
    // [b]rain[S]tatus
    // [r]obot[h]ealth
    // [l]ast[D]amage
    // [F]ill[S]tyle
    id: e.id,
    // optimisation
    // ed: e.vertices.map(({x, y}) => ({
    //     x: roundTo(x, 10),
    //     y: roundTo(y, 10) })),
    ce: [roundTo(e.position.x, 10),
            roundTo(e.position.y, 10)],
    // distance to center
    dc: roundTo(Math.hypot(
        e.position.x - arena.width / 2,
        e.position.y - arena.height / 2
    ), 10),
    an: roundTo(clamped_angle(e.angle), 100),
    eW: e.entityWidth,
    eH: e.entityHeight,
    mD: e.maxDimension || false,
    // eN: e.entityName, // optimisation
    // eT: e.entityTeam, // optimisation
    ac: e.active,
    bS: e.brainStatus,
    rh: 100 - Math.floor(e.damage / e.maxHealth * 100),
    lD: (e.lastDamage.length == 0)
        ? false
        : Damage(e.lastDamage[e.lastDamage.length - 1]),
    // FS: e.render.fillStyle,
});

const Circles = e => ({
    // [ce]nter
    // [ra]dius
    id: e.id,
    ce: [roundTo(e.position.x, 10),
            roundTo(e.position.y, 10)],
    ra: e.circleRadius,
});

const GenericEntities = e => ({
    // [e]ntity[N]ame
    // [e]ntity[T]eam
    // [e]ntity[l]abel - "eN (eT)", "entityType (entitySubtype)"
    id: e.id,
    eN: e.entityName,
    eT: e.entityTeam,
    el: (e.entityName && e.entityTeam)
        ? e.entityName + ' (' + e.entityTeam + ')'
        : e.entityType +
        (e.entitySubtype
            ? ' (' + e.entitySubtype + ')'
            : '')
});

const ClientShortStatus = state => ({
    // dev: key naming convention follows 1st, 2nd, and so on letters
    // for clients, root variable is commonly [st]ate (e.g. st.ro.re)
    ro: {
        re: state.round.remaining,
        pr: state.round.prestart,
        rs: state.round.results,
    },
    co: {
        fr: state.count.frames,
        se: state.count.seconds,
    },
    sa: state.status,
});

module.exports = {
    rad_deg: rad_deg,
    clamped_angle: clamped_angle,
    abs_bearing: abs_bearing,
    angle_to: angle_to,
    closest_edges: closest_edges,
    assign_keys: assign_keys,
    shuffleArray: shuffleArray,
    roundTo: roundTo,
    orderBy: orderBy,
    serialise: {
        GenericVertexes: GenericVertexes,
        ScanRanges: ScanRanges,
        Robots: Robots,
        Circles: Circles,
        GenericEntities: GenericEntities,
        ClientShortStatus: ClientShortStatus,
    },
    code_lookup : {
        'status': {
            'started'   : '1',
            'paused'    : '2',
            'completed' : '3',
            'waiting'   : '4',
            'init'      : '5',
            'reset'     : '6',
            'stopped'   : '7',
            'ready'     : '8',
            'running'   : '9',
        },
        // oN = [o]rigin[N]ame
        // oT = [o]rigin[T]eam
        // ol = [origin] [l]abel (client-side only)
        damage: {
            'D1': {
                short: 'out of bounds',
                label: '[oN] went out of bounds',
            },
            'D2': {
                short: 'self-damage',
                label: '[oN] damaged itself',
            },
            'D3': {
                short: 'hit',
                label: 'damaged by [oN]',
            },
            'D4': {
                short: 'wall collision',
                label: 'collided with [ol]',
            },
            'D5': {
                short: 'robot collision',
                label: 'bumped into [oN]',
            },
            'D6': {
                short: 'launch damage',
                label: '[oN] drained itself',
            }
        },
    },
};

/*
// verify: abs_bearing output
// dev: +ve radians = clockwise

for (const rad of [
    0,              // 0 degrees, 90 bearing
    Math.PI/4,      // 45 degrees, 45 bearing
    Math.PI/3,      // 60 degrees, 30 bearing
    Math.PI/2,      // 90 degrees, 0 bearing
    Math.PI,        // 180 degrees, 270 bearing
    Math.PI*3/2,    // 270 degrees, 180 bearing
    Math.PI*2,      // 360 degrees, 90 bearing
    -1.965000469985275
]) {
console.log(
    "angle (rad)",
    clamped_angle(rad,2),
    "degrees",
    rad_deg(rad,2),
    "heading",
    abs_bearing(rad,2));
}

xxxx

// */
