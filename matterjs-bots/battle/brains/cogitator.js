const { assert } = require('console');
const fs = require('fs');

const utils = require("../utils.js");
const sandbox = require("./sandbox.js");

const brain_socket = require(
    __dirname + "/drivers/socket.js");

const brain_debug = fs.readFileSync(
    __dirname + '/drivers/debug.js', 'utf8');

const MAXLEN_ACTION = 400;
const MAXLEN_MEMORY = 1000;
const TIMEOUT_SANDBOX = 500;

const state = {
    active: false,
    runs: 0
};

const reset = () => {
    state.active = false;
    state.runs = 0;
}

const get_context = (robot, options) => {
    let context = JSON.parse(JSON.stringify({
        // state: read-only, brain cannot modify robot "laws"
        state: {
            "name": robot.entityName,
            "team": robot.entityTeam,
            "health": Math.max(
                0, 100 - Math.floor(
                    robot.damage / robot.maxHealth * 100)),
            "position": robot.position,
            "angle": utils.clamped_angle(robot.angle),
            "angleToCenter": utils.clamped_angle(robot.angleToCenter),
            "maxForce": robot.maxForce,
            "maxRotate": robot.maxRotate,
            "scanner": robot.scanner,
            "proximity": robot.proximity,
            "lastDamage": robot.lastDamage,
        },
        // round data
        round: {
            remaining: options.roundRemaining,
            active: options.activeRobots,
        },
        // memory: writable, persistent between ticks
        memory: robot.memory,
        // action: writable, not fully persistent between ticks
        // subject to validation, clamping, preprocess, postprocess, etc
        action: {
            "desiredAngle": robot.desiredAngle,
            "desiredForce": robot.desiredForce,
            "desiredLaunch": robot.desiredLaunch,
            "desiredScan": robot.desiredScan
        },
    }));

    context['debug'] = Object.assign({}, (options || {}).debug || {});

    return context;
}

const postprocess = (ctx) => {
    if (!ctx || typeof ctx != "object") {
        return;
    }

    ctx = ctx || {};

    ctx.action = ctx.action || {};
    ctx.memory = ctx.memory || {};

    // dereference/clone with size check

    ctx.action = JSON.stringify(ctx.action);
    if (ctx.action.length > MAXLEN_ACTION) throw "action too large";
    ctx.action = JSON.parse(ctx.action);

    ctx.memory = JSON.stringify(ctx.memory);
    if (ctx.memory.length > MAXLEN_MEMORY) throw "memory too large";
    ctx.memory = JSON.parse(ctx.memory);

    // sanity checks/cleanup

    if ('desiredForce' in ctx.action) {
        ctx.action.desiredForce = parseFloat(ctx.action.desiredForce);
        if (isNaN(ctx.action.desiredForce))
            throw Error('desiredForce must be a number');
    }

    if ('desiredScan' in ctx.action)
        ctx.action.desiredScan = parseFloat(ctx.action.desiredScan);

    if ('desiredLaunch' in ctx.action)
        ctx.action.desiredLaunch = Boolean(ctx.action.desiredLaunch);

    if ('desiredAngle' in ctx.action)
        ctx.action.desiredAngle = (
            ctx.action.desiredAngle === false
            ? false : utils.clamped_angle(ctx.action.desiredAngle));
}

const sync = ({robot, ctx}) => {
    if (!ctx || typeof ctx != "object") {
        // if robots have failling executors, this will be noisy!
        // console.log(robot.entityName, "context:", ctx);
        return;
    }

    ctx = ctx || {};

    let action = ctx.action || {},
        memory = ctx.memory || {};

    for (const prop of [
            "desiredAngle",
            "desiredForce",
            "desiredLaunch",
            "desiredScan"]) {
        // write action if found
        if (prop in action) robot[prop] = action[prop];
    }

    robot.memory = memory;

    // assert(ctx.debug.rand[0] == "custom"); // ensure correct prng
}

const async_run_all = async (robots, options) => {
    state.active = true;
    state.runs++;

    let prechecks = [],
        executors = [],
        hasErrors = false;

    // determine executor for each brain, queue but do not run

    robots
        .filter(r => r.active) // must be active
        .filter(r => 'brain' in r) // must have brain
        .forEach(robot => {
            var cname = robot.brain.constructor.name,
                context = get_context(robot, options),
                precheck = false,
                executor = false;

            // convert to promise when applicable
            if (cname == "Object") {

                if (robot.brain.precheck) {
                    precheck = () => {
                        return robot.brain.precheck(context)
                    }
                }

                // return context at promise resolution
                executor = () => {
                    return robot.brain.executor(context);
                };

            } else if (cname == "Function") {

                executor = () => {
                    // modify context by reference
                    robot.brain(context);
                    return context;
                };

            } else if (cname == "String") {

                if (options.framesReloadBrain &&
                        options.frames % options.framesReloadBrain == 0) {
                    if (robot.updateBrain) robot.updateBrain();
                }

                executor = () => {
                    // modify context by reference
                    sandbox.sync_execute(
                        robot.brain, {"context": context}, {
                            timeout: options.timeout || TIMEOUT_SANDBOX
                    });
                    return context;
                };

            } else {
                throw "unhandled brain type: " + cname;
            }

            if (precheck) prechecks.push([precheck, robot]);

            executors.push([executor, robot]);
        });

    // run prechecks
    // dev: mitigates some non-deterministic behaviour when debugging

    prechecks.forEach(([func, robot], idx) => {
        prechecks[idx] = new Promise(resolve => resolve(func()))
            .catch((e) => {
                hasErrors = true;
                robot.brainStatus = ["precheck", e.message || e];
                return false;
            });
    });

    await Promise.all(prechecks);

    // run executors

    let bots_executor_err = [];

    if (!hasErrors) {
        // commence execution of each queued executor
        executors.forEach(([func, robot], idx) => {
            executors[idx] = new Promise(resolve => resolve(func()))
                .then((context) => {
                    postprocess(context);
                    robot.brainStatus = true;
                    return {robot: robot, ctx: context};
                })
                .catch(e => {
                    hasErrors = true;
                    bots_executor_err.push(robot);
                    robot.brainStatus = ["executor", e.message || e];
                    return {robot: robot, ctx: false};
                })
        });

        const results = await Promise.all(executors);

        results.forEach(sync); // sync ignores bots with errors (no ctx)
    }

    state.active = false;

    return [!hasErrors, bots_executor_err];
}

module.exports = {
    driver: {
        debug_serverside: brain_debug,
        debug_socket: brain_socket,
        use_socket: brain_socket
    },
    state: state,
    reset: reset,
    async_run_all: async_run_all
};
