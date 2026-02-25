const seedrandom = require('seedrandom');

const Matter = require("matter-js");

const decomp = require('poly-decomp');
Matter.Common.setDecomp(decomp);

const utils = require("./utils.js");
const arrangements = require("./arrangements.js");
const brains = require("./brains/cogitator.js");
const loops = require("./loops.js");

// note: matterjs "angle" uses clockwise rotation from +ve x axis
// based on: "The rotation angle, clockwise in radians" for canvas
// https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/rotate

const angle360 = Math.PI * 2;
const angle180 = Math.PI;
const angle90 = Math.PI / 2;

const angleNorth = Math.PI * 3 / 2;
const angleSouth = Math.PI / 2;
const angleWest = Math.PI;
const angleEast = 0;

const robot_polygon_path = "0 100 20 50 50 50 " +
    "100 0 150 0 160 100 150 200 100 200 50 150 20 150";

let IIDCounter = -1,
    DEFAULTS = {
        numOfRobots: 4,
        maxRounds: 1000,
        maxRuntime: 43200,
        prestart: 6,
        autorestart: 12,
        defaultBrain: brains.driver.debug_serverside,
        realtime: true,
        INJECT_DEBUG_INTO_ROBOT: false,
    };

const inject_debug = (flag) => {
    DEFAULTS.DEBUG_INJECT_INTO_ROBOT = Boolean(parseInt(flag) || 0);
    console.log(
        '[GLOBAL:sim] inject_debug =', DEFAULTS.DEBUG_INJECT_INTO_ROBOT);
}

const set_fastmode = (flag) => {
    if (Boolean(parseInt(flag) || 0)) DEFAULTS.realtime = false;
    console.log(
        '[GLOBAL:sim] (realtime) =', DEFAULTS.realtime);
}

// dev: use a factory pattern for parallel runs
const Factory = (options) => {

    // dev: scope update loops for mass halt
    let Loops = loops.Factory();

    IIDCounter++;

    const settings = {
        sim: {
            numOfRobots: DEFAULTS.numOfRobots,
            maxRounds: DEFAULTS.maxRounds,
            maxRuntime: DEFAULTS.maxRuntime,
            prestart: DEFAULTS.prestart, // wait X seconds after start
            autorestart: DEFAULTS.autorestart, // shortened by prestart, if any
            defaultBrain: DEFAULTS.defaultBrain,
            IID: IIDCounter,
            created: new Date(),
            seed: "fixedseed", // usually changed via options
            realtime: DEFAULTS.realtime,
            physicsFPS: 60, // server physics framerate
            updateFPS: 15, // client framerate
            robotScale: 0.15,
            projectileSize: 3,
            projectileLeadOffset: -15,
            // keep last X logs
            robotDamageLogs: 10,
            // prevent reinitialisation, locks most client actions
            locked: false,
            // derived from: physicsFPS
            physicsRate: false,
            // derived from: updateFPS
            updateRate: false,
            // prng seeded with seed
            PRNG: false,
            // true = re-seed PRNG on each round
            identicalRounds: false,
            // prevents multi robot, single team rounds ending prematurely
            ignoreSingleTeamEndsRound: true,
            // debug settings
            INJECT_DEBUG_INTO_ROBOT: DEFAULTS.INJECT_DEBUG_INTO_ROBOT,
        },
        arena: {
            width: 900,
            height: 900,
            wall: 10,
            // derived from .width, .height
            center: {
                x: false,
                y: false,
            },
        },
        rules: {
            arrangement: {
                type: "raytrace",
                options: {
                    Sides: [1, 3, 0, 2],
                    angleOffset: Math.PI,
                    snapAngle: angle90
                },
                shuffle: true,
            },
            limit: {
                round: 60,
                lastrobot: 3.0,
                robotMaxHealth: 200,
                scanLenMin: 50,
                scanLenMax: false, // derived
                scanScaleMax: 10,
                scanScaleMin: 1,
                proximityMax: 1.5, // x body.maxDimension
                projectilePerSecond: 0.5,
            },
            damage: {
                wall: 1,
                robot: 2,
                projectile: 5,
                executorError: 5,
                launch: 0,
            },
            physics: {
                robotFrictionAir: 0.03,
                robotMaxForce: 0.001,
                robotMaxRotate: 0.272,
                projectileForce: 0.001,
                projectileRecoilForce: 0.001,
                projectileMinSpeed: 10,
            },
            ranking: {
                legacy_teams: [2,4,5],
                legacy_robots: [3,6,7],
                teams: [
                    'totalAlive',
                    '-averageDcenter',
                    'maxLifespan',
                    'averageHealth',
                    'averageAccuracy',
                ],
                robots: [
                    'alive',
                    '-dcenter',
                    'lifespan',
                    'health',
                    'accuracy'
                ],
            },
            initial: {
                robotScanDefault: 150,
            }
        },
        brains: []
    };

    options = options || {};

    utils.assign_keys(
        ["sim", "arena", "brains"],
        settings,
        options);

    utils.assign_keys(
        Object.keys(settings.rules),
        settings.rules,
        options.rules || {});

    // derived settings

    settings.sim.physicsRate = (
        1000 / settings.sim.physicsFPS); // == ms/frame

    settings.sim.updateRate = (
        1000 / settings.sim.updateFPS);

    settings.rules.limit.scanLenMax = Math.max(
        settings.arena.width, settings.arena.height) / 2;

    settings.arena.center.x = settings.arena.width/2;
    settings.arena.center.y = settings.arena.height/2;

    const projectile_launch_rate = (() => {
        let pps = settings.rules.limit.projectilePerSecond;
        if (pps == 'health') {
            return (body) => ((body.damage / body.maxHealth) + 0.5)
                    * settings.sim.physicsFPS;
        } else {
            let rate = pps * settings.sim.physicsFPS;
            return () => rate;
        }
    })();

    // initialise pseudo-random number generator
    // used for deterministic battle states

    const seed_prng = () => {
        if (settings.sim.identicalRounds || !settings.sim.PRNG) {
            settings.sim.PRNG = seedrandom(settings.sim.seed);
            console.log(
                "[sim:" + settings.sim.IID + "::seed_prng]",
                "length:", settings.sim.seed.length);
        }
    }

    // debug states

    const debug = {
        state           : 0,
        randomForward   : 0.5,
        randomHeading   : 0.005,
        scanFire        : true,
        PRNG            : () => {return settings.sim.PRNG();}
    };

    switch(debug.state) {
        case 0:
            // production
            break
        case 1:
            // debug: slow projectiles
            settings.sim.numOfRobots = 2;
            settings.rules.physics.projectileForce = 0.00002;
            settings.rules.physics.projectileMinSpeed = 0;
            debug.randomHeading = 0;
            debug.randomForward = 0;
            break;
        case 2:
            // debug: single dumb robot
            settings.sim.numOfRobots = 1;
            settings.rules.limit.lastrobot = 1000;
            debug.randomHeading = 0;
            debug.randomForward = 0;
            break;
        case 3:
            // debug: 3 robots - shooty
            settings.sim.numOfRobots = 3;
            debug.randomHeading = 0;
            debug.randomForward = 0;
            break;
        case 4:
            // debug: 2 robots - dumb
            settings.sim.numOfRobots = 2;
            debug.randomHeading = 0;
            debug.randomForward = 0;
            debug.scanFire = false;
            break;
        case 5:
            // debug: 24 fragile bots
            settings.sim.numOfRobots = 24;
            settings.rules.limit.robotMaxHealth = 10;
            break;
        case 6:
            // debug: 16 dumb bots
            settings.sim.numOfRobots = 16;
            debug.randomHeading = 0;
            debug.randomForward = 0;
            break;
        case 7:
            // debug: increased chances of quick tie
            settings.sim.numOfRobots = 24;
            settings.rules.damage.wall = 5;
            settings.rules.damage.robot = 0;
            settings.rules.damage.projectile = 200;
            break;
        default:
        // nothing
    }

    // internal events

    let Events = {};

    const on = (() => {
        let counter = 0;
        return (event, func) => {
            Events[event] = (Events[event] || {});
            Events[event][counter] = func;
            counter++;
            console.log(
                "[sim:" + settings.sim.IID + "::on]",
                event, counter);
            return counter;
        }
    })();

    const trigger = (event, extras) => {
        if (Events[event]) {
            let funcs = Object.values(Events[event]),
                len_funcs = funcs.length;
            for (let i=0; i<len_funcs; i++) {
                funcs[i]({
                    state: state,
                    Entities: Entities,
                    settings: settings,
                    extras: extras || false,
                });
            }
        }
    };

    // start of logic

    const collision_targets = 0x0002;

    /*
    dev: state is sent to clients - no private/secret values!

    state.status:
        * init [one-off], factory
        * waiting [main loop]
        * reset [main loop]
        * ready [main loop]
        * started [main loop]
          * state.round.prestart
          * state.round.remaining
        * paused [main loop]
        * running [main loop]
          * settings.sim.autorestart - back to "waiting"
        * completed [one-off] (when limits reached)
        * stopped [one-off] (when externally halted)
    */
    let state = {
        started: false,
        realtime: settings.sim.realtime,
        arena: settings.arena,
        round: {
            end: false,
            remaining: false,
            results: false,
            prestart: 0,
        },
        count: {
            rounds: 0,
            frames: 0,
            robots: 0,
            teams: 0,
            seconds: 0,
        },
        rankings: false,
        stopped: false,
        status: false,
    };

    state.status = utils.code_lookup['status']['init'];

    // current base state
    let state_base = {};

    let Engine = false,
        // dev: Entities is sent to clients
        Entities = {
            sensors: [],
            robots: [],
            projectiles: [],
            walls: []
        },
        BodyById = {},
        ScanByRobot = {};

    let Timeouts = {
        "recovery": false,
        "autorestart": false
    };

    /*  helpers */

    const radians_to_center = (body) => {
        // angle to arena center from given body

        return utils.angle_to(
            body.position.x, body.position.y,
            settings.arena.center.x, settings.arena.center.y);
    };

    const only_pair = (pair, entityType1, entityType2) => {
        // filter matterjs collision pairs and guarantee specific order

        let parentA = pair.bodyA.parent,
            parentB = pair.bodyB.parent;

        if (parentA.entityType == entityType1
                && parentB.entityType == entityType2)
            return [parentA, parentB];

        if (parentA.entityType == entityType2
                && parentB.entityType == entityType1)
            return [parentB, parentA];

        return false;
    }

    /*  initialisation and setup */

    const arena_wall = (x, y, w, h, options) => {
        return Matter.Bodies.rectangle(
            x, y, w, h,
            Object.assign({
                // physics properties (matterjs)
                isStatic: true,
                render: {
                    fillStyle: "gray"
                },
                // custom properties
                "entityType": "wall"
            }, options || {})
        )
    };

    let robotPolygon = false;

    const setup_robots = () => {
        let vertices = Matter.Vertices.fromPath(robot_polygon_path);

        Matter.Vertices.scale(
            vertices,
            settings.sim.robotScale,
            settings.sim.robotScale);

        let ys = vertices.map(v => v.y),
            xs = vertices.map(v => v.x),
            robotWidth = Math.max(...xs) - Math.min(...xs),
            robotHeight = Math.max(...ys) - Math.min(...ys),
            robotMaxDimension = Math.max(robotWidth, robotHeight);

        // make polygon origin centre of shape
        let _c = Matter.Vertices.centre(vertices);
        robotPolygon = vertices.map(({x, y}) => ({
            x: x - _c.x,
            y: y - _c.y}));

        // dev: useful for sprite sizing
        // console.log("[setup] robot vertex:", robotWidth, robotHeight);

        // determine start positions

        let robotStartPositions = [],
            minGap = 50,
            diagonal = Math.sqrt(
                Math.pow(robotWidth, 2) + Math.pow(robotHeight, 2)),
            spacer = Math.max(diagonal, minGap),
            allowed_x = settings.arena.width - (spacer * 2),
            allowed_y = settings.arena.height - (spacer * 2);

        if (settings.sim.numOfRobots == 1) {
            robotStartPositions.push([
                settings.arena.width / 2,
                settings.arena.height / 2,
                0 // "natural" angle - pointing to right
            ]);
        } else {
            robotStartPositions = (
                arrangements[settings.rules.arrangement.type](
                    settings.sim.numOfRobots,
                    settings.arena.center.x, settings.arena.center.y,
                    allowed_x, allowed_y,
                    settings.rules.arrangement.options || {}));

            if (settings.rules.arrangement.shuffle) {
                // dev: shuffle positions
                robotStartPositions = utils.shuffleArray(robotStartPositions);
            }
        }

        // generate the robot physics entities

        let unique_names = {},  // tracks _entityName
            unique_ids = {};    // tracks _entityID

        let robots = [...Array(settings.sim.numOfRobots)].map((v, idx) => {
            let robotPosition = robotStartPositions[idx],
                robotBrain = settings.brains[idx],
                failsafes = [];

            /* starting position of robot */

            if (!robotPosition) {
                robotPosition = [
                    settings.sim.PRNG() * allowed_x + spacer,
                    settings.sim.PRNG() * allowed_y + spacer,
                    settings.sim.PRNG() * angle360
                ];
                failsafes.push("randompos");
            }

            /* generate unique default robot id, name and team,
               * default always different teams
               * might be overidden later */

            let _entityID = 'R' + (idx + 1),
                _entityName = "Debug " + (idx + 1),
                _entityTeam = "Team " + (idx + 1);

            let defaultBrainLoaded = false,
                // store a secondary reference to brain,
                //  in case we need to rewrite robotBrain
                //  e.g. robotmnan brains
                refBrainObject = false;

            if (!robotBrain) {
                // robotBrain not supplied
                // dev: when .numOfRobots > .brains
                robotBrain = settings.sim.defaultBrain;
                defaultBrainLoaded = true;
                failsafes.push("defaultBrain");
            }

            if (typeof robotBrain == 'object') {
                // robotBrain might be:
                // * robotman-loaded brain
                // * socket connectors (will pass-through)
                // * .defaultBrain is an object

                if (robotBrain.version == 1) {
                    // is robotman-loaded brain
                    // robotBrain will be rewritten, keep ref to original
                    refBrainObject = robotBrain;

                    if (refBrainObject.id) {
                        _entityID = refBrainObject.id; // dev: NOT robot.id
                        _entityName = refBrainObject.id;
                    }

                    if (refBrainObject.name) {
                        _entityName = refBrainObject.name;
                    }

                    if (defaultBrainLoaded) {
                        // default brains always use auto-team names
                        // dev: prevents accidental collusion for "devteam"
                        // emulates behaviour of trainers
                    } else if (refBrainObject.team) {
                        _entityTeam = refBrainObject.team;
                        // if no team name provided, auto team name
                    }

                    // replace with "plain" brain
                    // dev: refBrainObject used again later
                    robotBrain = refBrainObject.brain;
                }
            }

            /* deduplicate robot ids and names
                * happens with identical server-side brains
                * name dedup with ' number' appended
                * id dedup with [number] suffix */

            if (_entityID in unique_ids) {
                unique_ids[_entityID]++;
                _entityID += '[' + unique_ids[_entityID] + ']';
                console.log(
                    "[sim:" + settings.sim.IID + "::setup_robots]",
                    idx + ", duplicate robot id replaced", _entityID);
            } else {
                unique_ids[_entityID] = 1;
            }

            if (_entityName in unique_names) {
                unique_names[_entityName]++;
                _entityName += ' ' + unique_names[_entityName];
                console.log(
                    "[sim:" + settings.sim.IID + "::setup_robots]",
                    idx + ", duplicate robot name replaced", _entityName);
            } else {
                unique_names[_entityName] = 1;
            }

            /* generate physics robot entity with custom properties */

            let Robot = Matter.Bodies.fromVertices(
                robotPosition[0],
                robotPosition[1],
                vertices,
                {
                    // physics properties (matterjs)
                    isStatic        : false,
                    restitution     : 0.95,
                    frictionAir     : settings.rules.physics.robotFrictionAir,
                    collisionFilter: {
                        category    : collision_targets
                    },
                    // use for external reference, optional
                    entityID        : _entityID,
                    // custom identification - visible to robots
                    entityName      : _entityName,
                    entityTeam      : _entityTeam,
                    entityType      : "robot",
                    // custom settings
                    entityWidth     : robotWidth,
                    entityHeight    : robotHeight,
                    maxDimension    : robotMaxDimension,
                    maxHealth       : settings.rules.limit.robotMaxHealth,
                    maxForce        : settings.rules.physics.robotMaxForce,
                    maxRotate       : settings.rules.physics.robotMaxRotate,
                    // custom states
                    active          : true,
                    memory          : {},
                    brain           : robotBrain,
                    brainStatus     : true,
                    damage          : 0,
                    tkoAt           : -1,
                    desiredScan     : settings.rules.initial.robotScanDefault,
                    desiredForce    : 0.0,
                    desiredAngle    : robotPosition[2],
                    desiredLaunch   : false,
                    angleToCenter   : angle180,
                    scanner: {
                        projectile  : [],
                        robot       : [],
                        wall        : [],
                        ALL         : []
                    },
                    projectile: {
                        last_frame  : false,
                        count       : 0,
                        hits        : 0,
                        misses      : 0
                    },
                    proximity       : [],
                    lastDamage      : [],
                }
            );

            // mutate robot entity with utility methods

            Robot.readyToLaunch = () => {
                let diff = state.count.frames - (Robot.projectile.last_frame || 0);
                if (diff < projectile_launch_rate(Robot)) return false;
                return true;
            };

            if (refBrainObject && refBrainObject.update) {
                Robot.updateBrain = () => {
                    refBrainObject.update();
                    Robot.brain = refBrainObject.brain;
                };
            };

            return Robot;

        }); // end: robots .map

        /* post-process robot entities */

        let teams = new Set();

        robots.forEach(robot => {
            // workaround, setting angle in options caused malformed svg
            // only apply random angle if more than 1 robot and no preset
            if (robot.desiredAngle !== false) {
                Matter.Body.setAngle(robot, robot.desiredAngle);
                robot.angleToCenter = radians_to_center(robot);
            }
            robot.desiredAngle = false;

            teams.add(robot.entityTeam);
        });

        console.log(
            "[sim:" + settings.sim.IID + "::setup_robots]",
            "setup",
                robots.length, "robots",
                Array.from(teams).length, "teams");

        return robots;
    };

    const stop_all_pending_events = () => {
        toggle_pause(true, "reset");

        Loops.stop(settings.sim.IID + "|physics");
        Loops.stop(settings.sim.IID + "|updates");

        // support different types of timeouts, intervals
        let keys = Object.keys(Timeouts);
        for (i=keys.length-1; i>-1; i--) {
            let key = keys[i],
                val = Timeouts[key];
            if (!val) continue;
            let type = typeof val;
            if (type == "number") {
                clearTimeout(val);
            } else if (type == "object") {
                if ("getInterval" in val) {
                    clearInterval(val.getInterval());
                } else if ("getTimeout" in val) {
                    clearTimeout(val.getTimeout());
                } else {
                    console.log(
                        "[sim:" + settings.sim.IID
                            + "::stop_all_pending_events]",
                        "unhandled: " + key + "=" + val);
                }
            }else {
                throw "unrecognised timeout: " + key + " of " + type;
            }
            Timeouts[key] = false;
        }
    }

    const simulation_reset = () => {
        stop_all_pending_events();

        // remove any pre-existing entity references
        for (const type of ["walls", "robots", "projectiles", "sensors"]) {
            Entities[type].forEach((body) => {
                Matter.Composite.remove(Engine.world, body, true);
            });
            Entities[type] = [];
        }
        Object.keys(BodyById).forEach((key)=>{
            delete BodyById[key];
        });
        Object.keys(ScanByRobot).forEach((key)=>{
            delete ScanByRobot[key];
        });

        if (Engine) {
            Matter.Events.off(Engine);
            Matter.Composite.clear(Engine.world, false, true);
            Matter.Engine.clear(Engine);

            Engine.events = {};
            Engine.world = false;
            Engine = false;

            console.log(
                "[sim:" + settings.sim.IID + "::simulation_reset]",
                "engine disposed");
        }

        seed_prng();

        state.status = utils.code_lookup['status']['reset'];
    }

    const simulation_stop = () => {
        console.log(
            "[sim:" + settings.sim.IID + "::simulation_stop]");

        simulation_reset();

        state.status = utils.code_lookup['status']['stopped'];

        trigger('simulation_stop');
    }

    const simulation_init = (paused) => {
        if (!state.started) state.started = new Date();

        simulation_reset();

        // ensure simulation starts in paused state
        toggle_pause(true, "init");

        // update client settings
        state.arena = settings.arena;
        state.realtime = settings.sim.realtime;

        // setup all bodies

        Entities.walls = [
            arena_wall(
                settings.arena.center.x,
                -(settings.arena.wall/2),
                settings.arena.width,
                settings.arena.wall, {
                    entitySubtype: "north"
                }),
            arena_wall(
                -(settings.arena.wall/2),
                settings.arena.center.y,
                settings.arena.wall,
                settings.arena.height, {
                    entitySubtype: "west"
                }),
            arena_wall(
                settings.arena.width + (settings.arena.wall/2),
                settings.arena.center.y,
                settings.arena.wall,
                settings.arena.height, {
                    entitySubtype: "east"
                }),
            arena_wall(
                settings.arena.center.x,
                settings.arena.height + (settings.arena.wall/2),
                settings.arena.width,
                settings.arena.wall, {
                    entitySubtype: "south"
                })
        ]

        Entities.robots = setup_robots();

        Entities.projectiles = [];

        // initialise matter.js physics engine
        Engine = Matter.Engine.create();
        Engine.gravity.y = 0;

        // initialise all bodies and generate lookup
        let bodies = Object.values(Entities).flat();
        Matter.Composite.add(Engine.world, bodies);
        bodies.forEach(body => BodyById[body.id] = body);

        console.log(
            "[sim:" + settings.sim.IID + "::simulation_init]",
            "body count", Object.keys(BodyById).length);

        // initialise collision handlers
        // for both: scanner "hits" and physical collisions

        Matter.Events.on(Engine, 'collisionStart', function(event) {
            detect_projectile_hit(event.pairs);
            detect_wall_collision(event.pairs);
            detect_robot_collision(event.pairs);

            detect_scanner_hit(event.pairs);

            // XXX: obsolete, future reference
            // highlight_dynamic_collision(event.pairs, 'cyan');
        });

        Matter.Events.on(Engine, 'collisionActive', function(event) {
            // XXX: obsolete, future reference
            // highlight_dynamic_collision(event.pairs, 'blue');
        });

        Matter.Events.on(Engine, 'collisionEnd', function(event) {
            // XXX: obsolete, future reference
            // highlight_dynamic_collision(event.pairs, false);
        });

        // update round state
        state.count.rounds++;
        state.round.prestart = settings.sim.prestart;
        state.round.end = settings.rules.limit.round;
        state.round.remaining = 0;
        state.round.results = false;

        // keep base state updated
        // dev: required for subsequent rounds on client-side
        refresh_state_base();

        state.status = utils.code_lookup['status']['ready'];

        if (typeof paused === "undefined") paused = false;

        simulation_start(paused);
    }

    let runningTick = false;

    const simulation_tick = async () => {
        if (runningTick) {
            // dev: ensure only one instance running at a time
            //  all "short-circuits" here need to reset "runningTick"
            console.log(
                '[sim:' + settings.sim.IID + '::simulation_tick]' +
                'already running');
            return true;
        }
        runningTick = true;

        count_population();

        // state.paused will prevent roundHasEnded check
        let tickForward = !state.paused && !roundHasEnded();

        if (tickForward) {
            // dev: may be overidden by pause
            state.status = utils.code_lookup['status']['running'];

            if (state.round.prestart > 0) {
                // dev: round start countdown using physics rate
                state.round.prestart -= settings.sim.physicsRate/1000;
                state.round.prestart = utils.roundTo(
                    Math.max(0, state.round.prestart), 100);

                runningTick = false;
                return true;
            }

            let options = {
                frames: state.count.frames,
                framesReloadBrain: settings.sim.physicsFPS * 5,
                // additional state keys to supply to brain
                roundRemaining: state.round.remaining,
                activeRobots: state.count.robots,
            };

            if (settings.sim.INJECT_DEBUG_INTO_ROBOT) {
                options['debug'] = debug;
            }

            let [ALL, bots_executor_err] = await
                brains.async_run_all(Entities.robots, options);

            if (!ALL) {
                if (bots_executor_err.length > 0) {
                    for (let i=0; i<bots_executor_err.length; i++) {
                        shock_robot(
                            bots_executor_err[i],
                            settings.rules.damage.executorError);
                    }
                } else {
                    toggle_pause(true, "recovery, wait", true);
                    Timeouts.recovery = setTimeout(() => {
                        toggle_pause(false, "recovery, check", true);
                    }, 3000);

                    runningTick = false;
                    return true;
                }
            }

            // the battle has begun
            // dev: must happen after any prestarts
            if (state.count.frames == 0) {
                trigger('simulation_tick.0')
            }

            scanner_reset();

            state.count.frames++;
            state.count.seconds = utils.roundTo(
                state.count.frames / settings.sim.physicsFPS, 100);

            try {
                Matter.Engine.update(Engine, settings.sim.physicsRate);
            } catch (e) {
                console.log(
                    "[sim:" + settings.sim.IID + "::simulation_tick]",
                    "MATTERJS", e);
                simulation_stop();

                runningTick = false;
                return false;
            }

            process_rotations();
            process_propulsion();
            process_projectiles();

            update_all_scans();
            update_proximity_alarms();

            cleanup_projectiles();
            cleanup_robots();
        };

        runningTick = false;
        return tickForward;
    }


    const refresh_state_base = () => {
        // minimum data required to for client-side init, reset
        // generated and accessible to external libraries
        // [f]ixed[E]ntities - robots + walls
        // [d]amage[C]odes
        // [st]atus
        // [li]mits
        // dev: sent once per page load, new round

        state_base.fE = [
            ...Entities.robots.map(utils.serialise.GenericEntities),
            ...Entities.walls.map(utils.serialise.GenericEntities)];
        state_base.cl = utils.code_lookup;
        state_base.st = JSON.parse(JSON.stringify(state));
        state_base.st.limit = {
            rounds: settings.sim.maxRounds,
            runtime: settings.sim.maxRuntime,
        };
        state_base.st.RP = robotPolygon;

        // console.log(
        //     '[sim:' + settings.sim.IID + '::simulation_start]',
        //     'fixedEntities:', state_base.fE.length);
    };

    const status_updates = async () => {
        // state is always updated - regardless of run state
        // received by arena.init.js
        //  [ro]bots
        //  [pr]ojectiles
        //  [se]nsors
        //  [wa]lls
        //  [st]atus
        //      [s]t[a]tus: utils.code_lookup['status']
        //      [ro]und
        //          [r]e[s]ults
        // dev: sent at client framerate

        let sync = {
            ro: Entities.robots.map(robot => utils.serialise.Robots(robot, settings.arena)),
            pr: Entities.projectiles.map(utils.serialise.Circles),
            se: Entities.sensors.map(utils.serialise.ScanRanges),
            st: utils.serialise.ClientShortStatus(state),
        };

        trigger('status_updates', sync);
    };

    const simulation_start = async (paused) => {
        trigger('simulation_start.top');

        console.log(
            "[sim:" + settings.sim.IID + "::simulation_start]",
            "reset client states");

        state.count.frames = 0;
        state.count.seconds = 0;

        console.log(
            "[sim:" + settings.sim.IID + "::simulation_start]",
            "start client updates...");

        toggle_pause(paused, "default state");

        // reset state
        brains.reset();

        if (settings.sim.realtime) {

            Loops.start(
                settings.sim.IID + "|updates",
                status_updates,
                settings.sim.updateRate);

            Loops.start(
                settings.sim.IID + "|physics",
                simulation_tick,
                settings.sim.physicsRate);

        } else {
            // resolve as soon as possible

            let running = false,
                ts_started = (new Date()).getTime(),
                ts_logged = false,
                frames_per_update = Math.floor(
                    settings.sim.physicsFPS/settings.sim.updateFPS);

            Loops.start(
                settings.sim.IID + "|physics",
                async () => {
                    running = await simulation_tick();
                    if (!running) return;
                    // manually trigger updates at similar realtime rate
                    // dev: for recordings, socket updates (will be throttled)
                    if (state.count.frames % frames_per_update == 0)
                        status_updates();
                    let ts_now = (new Date).getTime();
                    if (ts_logged === false || ts_now - ts_logged > 2000) {
                        console.log(
                            "[sim:" + settings.sim.IID + "::simulation_start]" +
                            "[offline]",
                            "frame:", state.count.frames,
                            'seconds:', state.count.seconds + ' ' +
                                '(' + ((ts_now - ts_started)/1000) + ')',
                            "brain runs:", brains.state.runs,
                            'active robots:', state.count.robots,
                            "updates:", frames_per_update);
                        ts_logged = ts_now;
                    }
                }, 0); // 0 = non-blocking

            // ensures updates always sent regardless of physics loop
            Loops.start(
                settings.sim.IID + "|updates",
                status_updates,
                1000/1);
        };

        state.status = utils.code_lookup['status']['started'];

        trigger('simulation_start');
    }

    const PausableInterval = (func, ms_until, ms_tick) => {
        if (!ms_tick) ms_tick = 200;

        let paused = false,
            ticks = 0,
            interval = false;

        interval = setInterval(() => {
            if (paused) return;
            ticks += ms_tick;
            if (ticks > ms_until) func();
        }, ms_tick);

        const pause = (state) => {
            if (typeof state == "undefined") state = !paused;
            paused = state;
            return paused;
        };

        return {
            getInterval: () => { return interval; },
            isPaused: () => { return paused; },
            pause: pause,
        }
    };

    const toggle_pause = (force_state, reason, nolog) => {
        if (!reason) reason = "none";

        if (Timeouts.autorestart) {
            // special case for pausing during autorestart
            Timeouts.autorestart.pause();
            console.log(
                "[sim:" + settings.sim.IID + "::toggle_pause]",
                "autorestart pause state:",
                Timeouts.autorestart.isPaused());

        } else if (typeof force_state === "undefined") {
            state.paused = !state.paused;

            if (!nolog) console.log(
                "[sim:" + settings.sim.IID + "::toggle_pause]",
                "toggled state:", state.paused,
                "reason:", reason);

        } else if (state.paused != force_state) {
            state.paused = force_state;

            if (!nolog) console.log(
                "[sim:" + settings.sim.IID + "::toggle_pause]",
                "explicit state:", state.paused,
                "reason:", reason);
        }

        if (state.paused) {
            state.status = utils.code_lookup['status']['paused'];
        }
    }

    /*
    simulation loop functionality
    */

    const count_population = () => {
        let activeRobots = [],
            activeTeams = new Set(),
            len_entities_robots = Entities.robots.length;

        for (let i=0; i<len_entities_robots; i++) {
            let robot = Entities.robots[i];
            if (robot.active) {
                activeRobots.push(robot);
                activeTeams.add(robot.entityTeam);
            }
        }

        state.count.robots = activeRobots.length;
        state.count.teams = activeTeams.size;
    }

    const roundHasEnded = () => {
        end_round = [
            state.count.robots,
            (settings.sim.ignoreSingleTeamEndsRound ?
                9999 : state.count.teams)
        ].some(x => x <= 1);

        if (end_round) {
            state.round.end = Math.min(
                state.count.seconds + settings.rules.limit.lastrobot,
                state.round.end);
        }

        // resolve the round earlier when possible
        state.round.remaining = utils.roundTo(
            Math.max(0.00, state.round.end - state.count.seconds), 100);

        if (state.round.remaining > 0.00) return false;

        // end the round

        toggle_pause(true, "end of round"); // force simulation to pause

        if (determine_round_results()) {
            let stop_simulation = false;

            if (!stop_simulation) {
                // exceeded maximum rounds?
                stop_simulation = (settings.sim.maxRounds > 0
                    && state.count.rounds >= settings.sim.maxRounds);
                console.log(
                    "[sim:" + settings.sim.IID + "::roundHasEnded]",
                    "rounds", state.count.rounds, settings.sim.maxRounds,
                    "stop:", stop_simulation);
            }

            if (!stop_simulation) {
                // exceeded maximum runtime?
                let runtime = ((new Date).getTime() - settings.sim.created.getTime())/1000;
                stop_simulation = (settings.sim.maxRuntime > 0
                    && runtime >= settings.sim.maxRuntime);
                console.log(
                    "[sim:" + settings.sim.IID + "::roundHasEnded]",
                    "runtime", runtime, settings.sim.maxRuntime,
                    "stop:", stop_simulation);
            }

            if (!stop_simulation) {
                // autorestart if requested
                if (settings.sim.autorestart !== false) {
                    // assume its a number, in seconds
                    // dev: compensate for prestarts, if possible
                    let autorestart = settings.sim.autorestart - settings.sim.prestart;
                    // cap to 0 seconds (immediate)
                    autorestart = Math.max(0, autorestart);

                    console.log(
                        "[sim:" + settings.sim.IID + "::roundHasEnded]",
                        "new round in", autorestart);

                    Timeouts.autorestart = PausableInterval(
                        simulation_init,
                        autorestart * 1000
                    );
                }
            }

            if (stop_simulation) {
                state.stopped = true;
                state.status = utils.code_lookup['status']['completed'];
            } else {
                state.status = utils.code_lookup['status']['waiting'];
            }

            // dev fires once per round end
            trigger('roundHasEnded');
        }

        return true;
    }

    const update_all_scans = () => {
        // remove all existing scans
        let len_entities_sensors = Entities.sensors.length;
        for (let i=0; i<len_entities_sensors; i++) {
            let sensor = Entities.sensors[i];
            if (!sensor) continue;
            Matter.Composite.remove(Engine.world, sensor);
            Entities.sensors[i] = false;
        }
        // clear all references, just in case
        Entities.sensors = [];

        // commence with this scans for this frame
        let len_entities_robots = Entities.robots.length;
        for (let i=0; i<len_entities_robots; i++) {
            scan_ahead(Entities.robots[i]);
        }
    }

    const update_proximity_alarms = () => {
        let len_entities_robots = Entities.robots.length,
            len_entities_walls = Entities.walls.length,
            // optimisation: maximum number of scanned bodies
            fixed_count = len_entities_walls + (len_entities_robots - 1);
        for (let i=0; i<len_entities_robots; i++) {
            let robot = Entities.robots[i],
                range = robot.maxDimension * settings.rules.limit.proximityMax,
                // optimisation: preallocate structure
                nearby = Array(fixed_count),
                idx = 0;

            // distance to all walls
            // dev: for() is 11.99% faster over 10 rounds, 4 robots vs .map
            // ref commit: 2f79ce82
            for (let j=0; j<len_entities_walls; j++) {
                let other_body = dict_otherbody(Entities.walls[j], robot);
                if (other_body.range < range) nearby[idx++] = other_body;
            }

            // distance to other bots (active or not)
            // dev: for() is 13.55% faster over 10 rounds, 4 robots vs .reduce
            // ref commit: 2f79ce82
            for (let j=0; j<len_entities_robots; j++) {
                let other_robot = Entities.robots[j];
                if (other_robot.id == robot.id) continue;
                let other_body = dict_otherbody(other_robot, robot);
                if (other_body.range < range) nearby[idx++] = other_body;
            }

            // nearby may not fill entirely and contain <empty> values
            // remove <empty> based on total number of bodies added
            robot.proximity = nearby
                .slice(0, idx)
                .sort((a, b) => a.range - b.range);
        };
    }

    const process_rotations = () => {
        let len_entities_robots = Entities.robots.length;
        for (let i=0; i<len_entities_robots; i++) {
            let robot = Entities.robots[i];

            if (!robot.active) continue;
            if (robot.desiredAngle === false) continue;

            let rounding = 4,
                exp = Math.pow(10, rounding),
                angle = utils.clamped_angle(robot.angle, rounding),
                desiredAngle = utils.clamped_angle(robot.desiredAngle, rounding),
                clockwise = (angle - desiredAngle + angle360) % angle360 > Math.PI,
                diff = Math.round(Math.abs(angle - desiredAngle) * exp) / exp,
                rotation = false;

            if (diff < robot.maxRotate) {
                robot.desiredAngle = false;
                rotation = (clockwise ? diff : -diff);
                // console.log("partial", desiredAngle, angle, rotation);
            } else {
                rotation = (clockwise ? robot.maxRotate : -robot.maxRotate);
                // console.log("full", desiredAngle, angle, rotation);
            }
            Matter.Body.rotate(robot, rotation);

            robot.angleToCenter = radians_to_center(robot);

        };
    }

    const process_propulsion = () => {
        let len_entities_robots = Entities.robots.length;
        for (let i=0; i<len_entities_robots; i++) {
            let robot = Entities.robots[i];

            if (!robot.active) continue;
            if (isNaN(robot.desiredForce)) continue;
            if (robot.desiredForce == 0.0) continue;

            // cap to 1x +ve, 0.5x -ve
            robot.desiredForce = Math.max(
                Math.min(robot.maxForce, robot.desiredForce),
                -robot.maxForce/2);

            Matter.Body.applyForce(robot, robot.position, {
                x: Math.cos(robot.angle) * robot.desiredForce,
                y: Math.sin(robot.angle) * robot.desiredForce
            });

            robot.desiredForce = 0.0;

        };
    }

    const process_projectiles = () => {
        let len_entities_robots = Entities.robots.length;
        for (let i=0; i<len_entities_robots; i++) {
            let robot = Entities.robots[i];

            if (!robot.active) continue;
            if (!robot.desiredLaunch) continue;

            launch_projectile(robot);
        };
    }

    const cleanup_projectiles = () => {
        let len_entities_projectiles = Entities.projectiles.length;
        for (let i=0; i<len_entities_projectiles; i++) {
            let projectile = Entities.projectiles[i];

            // dev: removed during collision detection
            if (!projectile) continue;

            let x = projectile.position.x,
                y = projectile.position.y,
                speed = projectile.speed,
                angularSpeed = projectile.angularSpeed;
                isInvalid = [
                    // out of bounds
                    x < 0,
                    y < 0,
                    x > settings.arena.width,
                    y > settings.arena.height,
                    // slow, dev: start frame is always 0!
                    (speed < settings.rules.physics.projectileMinSpeed
                        && projectile.launchFrame != state.count.frames),
                    // spinning - probably from glancing bounce
                    angularSpeed > 0.0
                ].some(x => Boolean(x));

            if (!isInvalid) continue;

            // increment source robot miss stats
            if (projectile.refidSource in BodyById)
                BodyById[projectile.refidSource].projectile.misses++;

            // remove projectile from world, engine
            delete BodyById[projectile.id];
            Matter.Composite.remove(Engine.world, projectile);
            Entities.projectiles[i] = false;
        };

        // remove blanks from tracking array
        len_entities_projectiles = Entities.projectiles.length;
        let new_entities_projectiles = [];
        for (let i=0; i<len_entities_projectiles; i++) {
            let projectile = Entities.projectiles[i];
            if (projectile) new_entities_projectiles.push(projectile);
        }
        Entities.projectiles = new_entities_projectiles;
    }

    const cleanup_robots = () => {
        let len_entities_robots = Entities.robots.length;
        for (let i=0; i<len_entities_robots; i++) {
            let robot = Entities.robots[i];

            if (!robot.active) continue;

            let x = robot.position.x,
                y = robot.position.y;

            if (x < 0 || y < 0 ||
                    x > settings.arena.width || y > settings.arena.height) {

                console.log(
                    "[sim:" + settings.sim.IID + "::cleanup_robots]",
                    "robot exited arena");

                take_damage(robot, robot.maxHealth);

                // add to target robot damage log
                log_damage(robot, 'D1', robot);
            }
        }
    }

    const determine_round_results = () => {
        if(state.round.results) {
            console.log(
                "[sim:" + settings.sim.IID + "::determine_round_results]",
                "round results already stored");

            return false;
        }

        // list of robots by time, health, accuracy asc

        let robot_results = Entities.robots.map(r => ({
            id: r.id,
            entityName: r.entityName,
            entityTeam: r.entityTeam,
            entityID: r.entityID,
            lifespan:
                r.tkoAt == -1 ? state.count.seconds : r.tkoAt,
            hits:
                r.projectile.hits,
            misses:
                r.projectile.misses,
            health:
                Math.max(0, 100 - Math.floor(r.damage / r.maxHealth * 100)),
            accuracy:
                (r.projectile.hits == 0 && r.projectile.misses == 0
                    ? 0 : r.projectile.hits / (
                        r.projectile.hits + r.projectile.misses)) * 100,
            dcenter:
                Math.hypot(
                    r.position.x - settings.arena.center.x,
                    r.position.y - settings.arena.center.y,
                ),
            alive: r.active ? 1 : 0,
        }));

        // list of teams by max time, average health asc
        // dev: average health avoids issues with uneven team participants

        let team_results = Object.entries(robot_results.reduce(
            (acc, r) => {
                // create/merge successive rows into teams metadata
                let prev = acc[r.entityTeam] || {
                    teamRobots      : [],
                    minLifespan     : false,
                    maxLifespan     : false,
                    totalHealth     : false,
                    totalAccuracy   : false,
                    totalDcenter    : false,
                    totalAlive      : false,
                }
                // add current robot into stack
                prev.teamRobots.push({
                    id: r.id,
                    entityName: r.entityName,
                    lifespan: r.lifespan,
                    health: r.health,
                    accuracy: r.accuracy,
                    dcenter: r.dcenter,
                    alive: r.alive,
                });
                // update team statistics
                prev.minLifespan = Math.min(prev.minLifespan || state.count.frames, r.lifespan);
                prev.maxLifespan = Math.max(prev.maxLifespan || -1, r.lifespan);
                prev.totalHealth += r.health;
                prev.totalAccuracy += r.accuracy;
                prev.totalDcenter += r.dcenter;
                prev.totalAlive += r.alive;
                // update accumulator
                acc[r.entityTeam] = prev;
                return acc;
            }, {})).map(T => ({
                teamName: T[0],
                teamRobots: T[1].teamRobots,
                minLifespan: T[1].minLifespan,
                maxLifespan: T[1].maxLifespan,
                averageHealth: T[1].totalHealth / T[1].teamRobots.length,
                averageAccuracy: T[1].totalAccuracy / T[1].teamRobots.length,
                averageDcenter: T[1].totalDcenter / T[1].teamRobots.length,
                averageAlive: T[1].totalAlive / T[1].teamRobots.length,
            }));

        // win state by team, robots: placed, tie, none
        state.round.results = {
            "teams":
                determine_placement(
                    team_results,
                    settings.rules.ranking.teams),
            "robots":
                determine_placement(
                    robot_results,
                    settings.rules.ranking.robots),
        };

        console.log(
            "[sim:" + settings.sim.IID + "::determine_round_results]"
            + "[round " + state.count.rounds + " results] robots",
            state.round.results.robots
                .map((x, idx) =>
                    [idx + 1, x.participants.map(y => y.entityName).join(", ")])
        );

        console.log(
            "[sim:" + settings.sim.IID + "::determine_round_results]"
            + "[round " + state.count.rounds + " results] teams",
            state.round.results.teams
                .map((x, idx) =>
                    [idx + 1, x.participants.map(y => y.teamName).join(", ")])
        );

        trigger('determine_round_results');

        return true;
    }

    const determine_placement = (scoreList, positions) => {
        // returns participants list indexed by placement from 1st to last
        // scoreList presorted by determine_round_results()

        // order results by last to first ranking
        scoreList.sort(utils.orderBy(...positions));

        let places = [],
            placement = -1,
            comp_next = false,
            comp_prev = false,
            next = false;

        // consume until list is exhausted
        while(scoreList.length > 0) {
            next = scoreList.pop();

            // compares properties of scoreList items to increment placement
            comp_next = "";
            positions.forEach(idx => comp_next += "[" + next[idx] + "]");
            if (comp_prev === false || comp_next != comp_prev) placement++;
            comp_prev = comp_next;

            if (placement >= places.length) {
                places.push({"decision": "none", "participants": []});
            }

            places[placement].participants.push(next);

            switch(places[placement].participants.length) {
                case 1: places[placement].decision = "placed"; break;
                default: places[placement].decision = "tie"; break;
            }
        };

        return places;
    }

    /*
    scanner detection and handling
    */

    const scanner_reset = () => {
        ScanByRobot = {};

        let len_entities_robots = Entities.robots.length;
        for (let i=0; i<len_entities_robots; i++) {
            let robot = Entities.robots[i];

            robot.scanner = {
                "ALL": [],
                "wall": [],
                "robot": [],
                "projectile": []
            }
        };
    }

    const scanner_store = (robotid, bodyid) => {
        // called when scan cone detects a body (collision)
        if (!(robotid in ScanByRobot)) ScanByRobot[robotid] = {};
        if (!(bodyid in ScanByRobot[robotid])) {
            if (bodyid in BodyById) {
                ScanByRobot[robotid][bodyid] = BodyById[bodyid];
            }
        }
    }

    const dict_otherbody = (body, robot) => {
        let entityType = body.entityType,
            dx = body.position.x - robot.position.x, // (from robot.x)
            dy = robot.position.y - body.position.y, // (from robot.y)
            dict = {
                entityType      : entityType,
                id              : body.id,
                x               : body.position.x,
                y               : body.position.y,
                speed           : Math.round(body.speed * 1000)/1000,
                angle           : utils.clamped_angle(body.angle),
                // absolute angle from robot to body
                angleFromRobot  : utils.clamped_angle(Math.atan2(-dy, dx)),
                range           : Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2))
            };

        if (dict.entityType == "robot") {
            dict.active = body.active;
            dict.name = body.entityName;
            dict.team = body.entityTeam;
        } else if (dict.entityType == "wall") {
            dict.angle = 0;
            dict.entitySubtype = body.entitySubtype;
            // dev: offset wall thickness
            let walloffset = (settings.arena.wall / 2);
            // perpendicular to wall
            switch (body.entitySubtype) {
                case "west":
                    dict.range = Math.abs(dx + walloffset);
                    dict.angleFromRobot =  utils.clamped_angle(angleWest);
                    break;
                case "east":
                    dict.range = Math.abs(dx - walloffset);
                    dict.angleFromRobot =  utils.clamped_angle(angleEast);
                    break;
                case "north":
                    dict.range = Math.abs(dy + walloffset);
                    dict.angleFromRobot =  utils.clamped_angle(angleNorth);
                    break;
                case "south":
                    dict.range = Math.abs(dy - walloffset);
                    dict.angleFromRobot =  utils.clamped_angle(angleSouth);
                    break;
                default:
                    throw "invalid wall";
            }
        }

        return dict;
    }

    const scanner_update = () => {
        // updates all robot scanners
        let robotids = Object.keys(ScanByRobot),
            len_robotids = robotids.length;

        for (let i=0; i<len_robotids; i++) {
            let robotid = robotids[i];

            let robot = BodyById[robotid],
                buffer = {
                    wall: [],
                    robot: [],
                    projectile: [],
                    ALL: [],
                };

            if (!robot) continue; // in event of reset

            // optimisation: raytrace walls for reference later
            let raytracedWalls = utils.closest_edges(
                robot.position.x, robot.position.y,
                utils.clamped_angle(robot.angle),
                [0, settings.arena.height, settings.arena.width, 0]);

            // iterate through each detected body
            let detections = ScanByRobot[robotid],
                bodyids = Object.keys(detections),
                len_bodyids = bodyids.length;

            for (let j=0; j<len_bodyids; j++) {
                let bodyid = bodyids[j];

                let detected = dict_otherbody(detections[bodyid], robot);

                // special: if wall, use raytraced range instead of perpendicular
                if (detected.entityType == "wall") {
                    let raytracedWall = raytracedWalls.find(
                        x => x[0] == detected.entitySubtype);

                    if (raytracedWall) {
                        // replace properties with raytraced version
                        detected.range = raytracedWall[1];
                        detected.angleFromRobot = robot.angle;
                    } else {
                        // not found, happens if robot angled away
                        // from the wall, but the scanner cone is still in
                        // contact. this tends to happens when robot is
                        // rapidly turning or when bouncing from edges
                        detected = false;
                    }
                }

                // allow skipping entities
                if (detected === false) continue;

                buffer[detected.entityType].push(detected);

            }; // end for (detected bodies)

            // generate ALL - separated so we can preprocess walls
            buffer['ALL'].push(
                ...buffer.wall,
                ...buffer.robot,
                ...buffer.projectile);

            // sort all detection keys by nearest first
            let bufferkeys = Object.keys(buffer),
                len_bufferkeys = bufferkeys.length;
            for (k=0; k<len_bufferkeys; k++) {
                let bufferkey = bufferkeys[k];
                buffer[bufferkey].sort((a, b) => a.range - b.range);
            }

            robot.scanner = buffer;

        } // end for (robots.robotid)
    }

    const detect_scanner_hit = (pairs) => {
        let len_pairs = pairs.length;
        for (let i=0; i<len_pairs; i++) {
            let pair = pairs[i],
                valid = false;

            valid = only_pair(pair, "scan", "wall");
            if (valid) {
                scanner_store(valid[0].refidRobot, valid[1].id);
                continue;
            }

            valid = only_pair(pair, "scan", "robot");
            if (valid && valid[0].refidRobot != valid[1].id) {
                // other robots only - can't detect self
                scanner_store(valid[0].refidRobot, valid[1].id);
                continue;
            }

            valid = only_pair(pair, "scan", "projectile");
            if (valid && valid[0].refidRobot != valid[1].refidSource) {
                // other robot projectiles only
                scanner_store(valid[0].refidRobot, valid[1].id);
                continue;
            }
        }; // end for (pairs)

        scanner_update();
    }

    /*
    collision detection and handling
    dev: use for instead of forEach to optimise processing time (2-3x)
    ref: https://leanylabs.com/blog/js-forEach-map-reduce-vs-for-for_of/
    */

    // XXX: obsolete, future reference - damage_rgb() has been removed

    // const highlight_dynamic_collision = (pairs, hex) => {
    //     let len_pairs = pairs.length;
    //     for (let i=0; i<len_pairs; i++) {
    //         let pair = pairs[i];

    //         var valid = only_pair(pair, "robot", "wall");
    //         if (valid && valid[0].active) {
    //             valid[0].render.fillStyle = hex || damage_rgb(valid[0]);
    //             continue;
    //         }

    //         var valid = only_pair(pair, "robot", "projectile");
    //         if (valid && valid[0].active) {
    //             valid[0].render.fillStyle = hex || damage_rgb(valid[0]);
    //             continue;
    //         }

    //         var valid = only_pair(pair, "robot", "robot");
    //         if (valid) {
    //             if (valid[0].active)
    //                 valid[0].render.fillStyle = hex || damage_rgb(valid[0]);

    //             if (valid[1].active)
    //                 valid[1].render.fillStyle = hex || damage_rgb(valid[1]);

    //             continue;
    //         }

    //     }; // end for (pairs)
    // }

    const detect_projectile_hit = (pairs) => {
        let len_pairs = pairs.length;
        for (let i=0; i<len_pairs; i++) {
            let pair = pairs[i],
                valid = false;

            valid = only_pair(pair, "robot", "projectile");
            if (!valid) continue;

            take_damage(valid[0], settings.rules.damage.projectile);

            if (valid[1].refidSource in BodyById) {
                let originRobot = BodyById[valid[1].refidSource];
                // increment source robot hit stats
                originRobot.projectile.hits++;
                if (settings.rules.damage.projectile > 0) {
                    if (valid[0].active) {
                        log_damage(valid[0], 'D3', originRobot);
                    }
                }
                trigger('detect_projectile_hit.hit',
                    { r0: valid[0], r1: originRobot });
            }

            // remove projectile from world, engine
            delete BodyById[valid[1].id];
            let len_projectiles = Entities.projectiles.length;
            for (let j=0; j<len_projectiles; j++) {
                if (valid[1] == Entities.projectiles[j]) {
                    Entities.projectiles[j] = false;
                    break;
                }
            }
            Matter.Composite.remove(Engine.world, valid[1]);

        }; // end for (pairs)
    }

    const detect_wall_collision = (pairs) => {
        let len_pairs = pairs.length;
        for (let i=0; i<len_pairs; i++) {
            let pair = pairs[i],
                valid = false;

            valid = only_pair(pair, "robot", "wall");
            if (!valid) continue;

            take_damage(valid[0], settings.rules.damage.wall);

            if (settings.rules.damage.wall > 0) {
                if (valid[0].active) {
                    log_damage(valid[0], 'D4', valid[1]);
                }
            }

            trigger('detect_wall_collision.hit', { r0: valid[0] });

        }; // end for (pairs)
    }

    const detect_robot_collision = (pairs) => {
        let len_pairs = pairs.length;
        for (let i=0; i<len_pairs; i++) {
            let pair = pairs[i];

            valid = only_pair(pair, "robot", "robot");
            if (!valid) continue;

            take_damage(valid[0], settings.rules.damage.robot);
            take_damage(valid[1], settings.rules.damage.robot);

            if (settings.rules.damage.robot > 0) {
                if (valid[0].active) {
                    // add to left robot damage log
                    log_damage(valid[0], 'D5', valid[1]);
                }

                // add to right robot damage log
                if (valid[1].active) {
                    log_damage(valid[1], 'D5', valid[0]);
                }
            }

            trigger('detect_robot_collision.hit',
                { r0: valid[0], r1: valid[1] });

        }; // end for (pairs)
    }

    /*
    single-body methods
    all act on a single physics body
    */

    const scan_ahead = (robot) => {
        if (!robot.active) return;

        let lenMax = settings.rules.limit.scanLenMax,
            lenMin = settings.rules.limit.scanLenMin,
            scaleMax = settings.rules.limit.scanScaleMax,
            scaleMin = settings.rules.limit.scanScaleMin,
            scanWidthMultiplier = Math.min(
                Math.max(lenMax/robot.desiredScan, scaleMin),
                scaleMax),
            height = Math.min(
                Math.max(robot.desiredScan, lenMin),
                lenMax),
            width = robot.maxDimension * scanWidthMultiplier; // far edge width
            ws = robot.maxDimension, // near edge width
            scanSlope = 1 - ws/width, // calc slope of trapezoid
            cx = (height / 3) * ((2*width + ws) / (width + ws)), // centroid
            center_offset = cx + (robot.maxDimension / 2);

        let scanner = Matter.Bodies.trapezoid(
            robot.position.x + center_offset * Math.cos(robot.angle),
            robot.position.y + center_offset * Math.sin(robot.angle),
            width, height, scanSlope, {
                // physics properties (matterjs)
                isSensor        : true,
                angle           : robot.angle - angle90,
                render: {
                    // dev: might be ignored by client-side renderer
                    fillStyle   : "rgba(150, 150, 255, 0.1)"
                },
                collisionFilter: {
                    category    : collision_targets
                },
                // custom properties
                entityType      : "scan",
                refidRobot      : robot.id,
                added           : (new Date()).getTime(),
                scanDistance    : height // min-max clamped
            }
        );

        Matter.Composite.addBody(Engine.world, scanner);
        Entities.sensors.push(scanner);
    }

    const launch_projectile = (body) => {
        if (!body.readyToLaunch()) return; // rate-limited

        // launch projectile...

        body.projectile.last_frame = state.count.frames;

        body.projectile.count++;

        let projectile = Matter.Bodies.circle(
            body.position.x +
                ((body.maxDimension + settings.sim.projectileLeadOffset)
                    * Math.cos(body.angle)),
            body.position.y +
                ((body.maxDimension + settings.sim.projectileLeadOffset)
                    * Math.sin(body.angle)),
            settings.sim.projectileSize, {
                // physics properties (matterjs)
                inertia         : Infinity,
                restitution     : 0,
                frictionAir     : 0,
                friction        : 0,
                frictionStatic  : 1,
                collisionFilter: {
                    mask        : collision_targets
                },
                // custom properties
                launchFrame     : state.count.frames,
                entityType      : "projectile",
                refidSource     : body.id
            }
        );

        Matter.Composite.addBody(Engine.world, projectile);
        Entities.projectiles.push(projectile);
        BodyById[projectile.id] = projectile;

        Matter.Body.applyForce(projectile, projectile.position, {
            x: Math.cos(body.angle) * settings.rules.physics.projectileForce,
            y: Math.sin(body.angle) * settings.rules.physics.projectileForce
        });

        // apply recoil when firing projectile
        let recoilForce = -Math.abs(settings.rules.physics.projectileRecoilForce);
        if (recoilForce) {
            Matter.Body.applyForce(body, body.position, {
                x: Math.cos(body.angle) * recoilForce,
                y: Math.sin(body.angle) * recoilForce
            });
        }

        // rules: take damage from launch
        if (settings.rules.damage.launch > 0) {
            take_damage(body, settings.rules.damage.launch);
            log_damage(body, 'D6', body);
        }

        trigger('launch_projectile.launch', { b0: body });

        if ('desiredLaunch' in body) body.desiredLaunch = false;
    }

    const take_damage = (body, intensity) => {
        if (typeof intensity === "undefined") intensity = 1;

        // works on geometric body and robot
        let robot = false;
        if (body.entityType == "robot") {
            robot = body;
        } else {
            robot = body.parent;
        }

        robot.damage += intensity;
        if (robot.damage >= robot.maxHealth) {
            if (robot.active) knockout_robot(robot)
        }
    }

    const log_damage = (robot, code, origin) => {
        robot.lastDamage.push({
            atFrame: state.count.frames,
            type: code, // utils.code_lookup[damage]
            short: utils.code_lookup['damage'][code]['short'],
            origin: {
                'id': origin.id,
                'entityType': origin.entityType,
                'entitySubtype': origin.entitySubtype || '',
                'name': origin.entityName || '',
                'team': origin.entityTeam || '',
            },
        });
        robot.lastDamage = robot.lastDamage.slice(
            -settings.sim.robotDamageLogs);
    };

    const knockout_robot = (robot) => {
        robot.active = false;
        robot.tkoAt = state.count.seconds;

        trigger("knockout_robot", { r0: robot });
    }

    const shock_robot = (robot, damage) => {

        // dev: shock can be a purely visual/client effect
        trigger('shock_robot', { r0: robot });

        if (damage) {
            take_damage(robot, damage);

            // add to target robot damage log
            log_damage(robot, 'D2', robot);
        }
    }

    /* debug behaviours and methods */

    const debug_all_spread = (coordinates, force) => {
        // apply outward force to all robots from given coordinates
        // affects: inactive, active robots

        if (!force) force = 0.01;

        Entities.robots.forEach(robot => {
            const deltaVector = Matter.Vector.sub(robot.position, coordinates);
            const normalizedDelta = Matter.Vector.normalise(deltaVector);
            const forceVector = Matter.Vector.mult(normalizedDelta, force);
            Matter.Body.applyForce(robot, robot.position, forceVector);
        });
    }

    // public properties/methods

    const callfunc = (func) => {
        return () => {
            if (state.started && settings.sim.locked) {
                console.log(
                    '[sim:' + settings.sim.IID + '::' + func.name + ']',
                    'denied, simulation locked');
                return false;
            }
            func();
        }
    }

    Arena = {
        // read-only
        code_lookup: utils.code_lookup,
        settings: settings,
        state_base: state_base,
        state: state,
        Entities: Entities,
        // setters
        on: on,
        // methods
        start: callfunc(simulation_init),
        pause: callfunc(toggle_pause),
        reset: callfunc(simulation_reset),
        stop: simulation_stop,
        // methods: debug
        debug_inject_robot: false,
        debug_all_spread: debug_all_spread,
        debug_all_rotate_right: () => {
            Entities.robots.forEach(robot => {
                robot.desiredAngle = utils.clamped_angle(
                    robot.angle + 0.174533);
            });
        },
        debug_all_rotate_left: () => {
            Entities.robots.forEach(robot => {
                robot.desiredAngle = utils.clamped_angle(
                    robot.angle - 0.174533);
            });
        },
        debug_all_move_forward: () => {
            Entities.robots.forEach(robot => {
                robot.desiredForce = robot.maxForce;
            });
        },
        debug_all_face_center: () => {
            Entities.robots.forEach(robot => {
                robot.desiredAngle = radians_to_center(robot);
            });
        },
        debug_all_fire: () => {
            Entities.robots.forEach(robot => {
                robot.desiredLaunch = true;
            });
        }
    }

    state.status = utils.code_lookup['status']['waiting'];

    return Arena;

}; // Factory()

module.exports = {
    DEFAULTS: DEFAULTS,
    Factory: Factory,
    utils: utils,
    // global debug
    set_fastmode: set_fastmode,
    inject_debug: inject_debug,
};
