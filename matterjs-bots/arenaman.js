const brains = require("./battle/brains/cogitator.js");
const simulation = require("./battle/simulation.js");
const robotman = require("./robotman.js");
const logman = require('./logman.js');

const utils = require('./utils.js');

let Arenas = {};

const serversideArena = (listRobots, arenaOptions) => {
    let arenaid = arenaOptions.arenaid,
        Arena = getArena(arenaid);

    if (Arena) return Arena;

    let loadedBrains = [];

    let Robots = robotman.loadlist(listRobots);
    Object.values(Robots).forEach(R => loadedBrains.push(R));

    let numOfRobots = loadedBrains.length;

    if (numOfRobots <= 1)
        throw Error('[arenaman] at least two robots required');

    let Options = {
        sim: {
            maxRounds: 3,
            autorestart: 10,
            prestart: 5,
            maxRuntime: false,
            numOfRobots: numOfRobots,
            seed: utils.secure_keystring(32),
            defaultBrain: '/* do nothing */',
        },
        arena: {},
        brains: loadedBrains,
        rules: {
            limit: {
                round: 60
            }
        }
    }

    // give indicator for upcoming matches for breaks between rounds
    if (Options.sim.autorestart >= 10)
        Options.sim.prestart = Math.round(Options.sim.autorestart/2);

    simulation.utils.assign_keys(
        ["sim", "arena"],
        Options,
        arenaOptions);

    simulation.utils.assign_keys(
        Object.keys(arenaOptions.rules || {}),
        Options.rules,
        arenaOptions.rules || {});

    Arena = simulation.Factory(Options);

    attach_loggers(Arena, arenaid);
    attach_recorder(Arena, arenaid);

    Arenas[arenaid] = Arena;

    return Arena;
}

const multipurposeArena = (legacyConfig) => {
    let arenaid = legacyConfig.arenaid,
        Arena = getArena(arenaid);

    if (Arena) return Arena;

    let minrobots = 2,
        maxrobots = 8,
        p_sim = {
            seed: arenaid,
        },
        p_brains = [];

    if ('numOfRobots' in legacyConfig){
        // range [ minrobots, maxrobots ]
        p_sim["numOfRobots"] = (
            Math.max(
                minrobots,
                Math.min(
                    parseInt(legacyConfig.numOfRobots) || minrobots,
                    maxrobots))
        );
    }

    if ('manualBrains' in legacyConfig){
        let supplied = String(legacyConfig.manualBrains || '').trim();

        if (!supplied) {
            // empty param, ignore
        } else if (isNaN(supplied)) {
            // comma-separated robot ids
            // dev: p_sim["numOfRobots"] replaced

            supplied = supplied.split(",");

            // range [ minrobots, maxrobots ]
            numManuals = (
                Math.max(
                    minrobots,
                    Math.min(
                        supplied.length || 0,
                        maxrobots))
            );

            // load server-side brains
            // dev: users may request (socket) connectors via
            //  (legacy) "-MANUAL-" or "___BROWSERBOT___";
            //  socket connectors init is order-sensitive and
            //  rely internally on the "Debug X" naming convention.
            //  therefore, sort the list so manual appears on top and is
            //  processed first so that the connectors will acquire
            //  Debug 1, Debug 2, etc names */
            let _is_socket = id => [
                    '___BROWSERBOT___',
                    '-MANUAL-'].includes(id),
                _sockets = supplied.filter(id => _is_socket(id)),
                _others = supplied.filter(id => !_is_socket(id));
            supplied = _sockets.concat(_others);
            for (let i=0; i<numManuals; i++) {
                let robotid = supplied[i];
                if (_is_socket(robotid)) {
                    p_brains.push(
                        brains.driver.use_socket(
                            legacyConfig.clientConnection())
                    );
                } else {
                    let brain = robotman.load(robotid);
                    if (brain) {
                        console.log(
                            "[arenaman] server-side robot",
                            arenaid, robotid);
                        p_brains.push(brain);
                    } else {
                        console.log(
                            "[arenaman] server-side robot not found",
                            arenaid, robotid);
                    }
                }
            };
            // replaced numOfRobots
            p_sim["numOfRobots"] = p_brains.length;
        } else {
            // legacy: number specified
            // default: use socket connectors for remote test/training
            // range: [ 0, maxrobots ]
            numManuals = (
                Math.max(
                    0,
                    Math.min(
                        parseInt(legacyConfig.manualBrains) || 0,
                        parseInt(p_sim["numOfRobots"]) ||
                            simulation.DEFAULTS.numOfRobots,
                        maxrobots))
            );

            // load the socket connectors
            for (var i=0; i<numManuals; i++) {
                p_brains.push(
                    brains.driver.use_socket(
                        legacyConfig.clientConnection())
                );
            };
        }
    }

    if ('replaceDefaultBrain' in legacyConfig){
        let altbrain = legacyConfig['replaceDefaultBrain'].trim();
        let brain = robotman.load(altbrain);
        if (brain) {
            p_sim['defaultBrain'] = brain;
        } else {
            p_sim['defaultBrain'] = '/* do nothing */';
        }
    }

    // range [ minrobots, maxrobots ]
    // dev: if numofRobots not specified,
    //  possible when arena initiased without config
    if (!p_sim["numOfRobots"] || p_sim["numOfRobots"] < minrobots) {
        console.log('[arenaman] simulation default numOfRobots');
        p_sim["numOfRobots"] = simulation.DEFAULTS.numOfRobots;
    }

    Arena = simulation.Factory({
        sim: p_sim,
        brains: p_brains
    });

    attach_loggers(Arena, arenaid);
    attach_recorder(Arena, arenaid);

    Arenas[arenaid] = Arena;

    return Arena;
}

const attach_loggers = (Arena, arenaid) => {
    Arena.on('simulation_start', async () => {
        // create a blank log if it does not exist, do nothing if it does
        // dev: useful hint to other processes (e.g. compman) for arena init
        logman.json.store_robot_results(arenaid, false);
    });

    Arena.on('determine_round_results', async ({state, Entities}) => {
        logman.csv.store_robot_results(
            arenaid,
            state.round.results.robots,
            Entities.robots,
        );

        logman.json.store_robot_results(
            arenaid,
            state.round.results.robots,
        );
    });
};

const attach_recorder = (Arena, arenaid) => {
    let Recording = [],
        active = false,
        fileprefix = '_recording.',
        limit = 20;

    Arena.on('simulation_start.top', async () => {
        active = false;

        // clear and initialise headers
        Recording = [];
        Recording.push([ 0, 0, 'init', Arena.state_base ]);
    });

    Arena.on('simulation_tick.0', async () => {
        console.log('[arenaman] recording started:', arenaid);
        active = true;
    });

    Arena.on('status_updates', async ({state, extras}) => {
        if (!active) return;

        Recording.push([
            state.count.frames,
            state.count.seconds,
            'update',
            JSON.parse(JSON.stringify(extras)),
        ]);
    });

    Arena.on('knockout_robot', async ({state, extras}) => {
        if (!active) return;

        Recording.push([
            state.count.frames,
            state.count.seconds,
            'event',
            JSON.parse(JSON.stringify([
                'robot knockout', {
                    id  : extras.r0.id,
                    x   : extras.r0.position.x,
                    y   : extras.r0.position.y,
                }
            ]))
        ]);
    });

    Arena.on('robot shock', async ({state, extras}) => {
        if (!active) return;

        Recording.push([
            state.count.frames,
            state.count.seconds,
            'event',
            JSON.parse(JSON.stringify([
                'robot shock', {
                    id  : extras.r0.id,
                    x   : extras.r0.position.x,
                    y   : extras.r0.position.y,
                }
            ]))
        ]);
    });

    Arena.on('roundHasEnded', async () => {
        console.log('[arenaman] recording stopped:', arenaid);
        active = false;

        let prev = logman.json.list(
            fileprefix + arenaid + '.*').sort().reverse();
        while (prev.length > limit) {
            filepath = prev.pop();
            logman.json.remove(filepath);
        }

        logman.json.store(
            fileprefix +
                arenaid + '.' +
                utils.dateToLocalText(new Date(), true),
            Recording
        );
    });
}

const getArena = (arenaid) => {
    if (arenaid in Arenas) return Arenas[arenaid];
    return false;
};

const removeArena = (arenaid) => {
    if (arenaid in Arenas) {
        Arenas[arenaid].stop();
        delete Arenas[arenaid];
        console.log("[arenaman] removed arena: ", arenaid);
    }
};

module.exports = {
    Arena : {
        multipurpose: multipurposeArena,
        serverside: serversideArena,
    },
    Arenas: Arenas,
    get: getArena,
    remove: removeArena,
};
