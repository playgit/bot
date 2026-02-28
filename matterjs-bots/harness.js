#!/usr/bin/env node

// Headless battle harness for rapid bot iteration
// Usage: node harness.js --robots apex,sentinel,stinger,default --rounds 100 [--parallel 8] [--quiet]

const { fork } = require('child_process');

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
    const idx = args.indexOf('--' + name);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
};
const hasFlag = (name) => args.includes('--' + name);

const robotList = getArg('robots', 'apex,sentinel,stinger,default,spinbot,fastbot').split(',');
const rounds = parseInt(getArg('rounds', '10'));
const parallel = parseInt(getArg('parallel', '1'));
const quiet = hasFlag('quiet');

if (hasFlag('help')) {
    console.log('Usage: node harness.js [options]');
    console.log('  --robots    comma-separated bot IDs (default: apex,sentinel,stinger,default,spinbot,fastbot)');
    console.log('  --rounds    number of rounds to run (default: 10)');
    console.log('  --parallel  number of parallel workers (default: 1)');
    console.log('  --quiet     suppress per-round output');
    console.log('  --help      show this message');
    process.exit(0);
}

// ── Worker mode: run simulation and send stats back via IPC ──
if (process.env.HARNESS_WORKER === '1') {
    const simulation = require('./battle/simulation.js');
    const robotman = require('./robotman.js');
    const utils = require('./utils.js');

    const workerRounds = parseInt(process.env.HARNESS_ROUNDS);
    const workerRobots = process.env.HARNESS_ROBOTS.split(',');
    const workerQuiet = process.env.HARNESS_QUIET === '1';
    const workerId = parseInt(process.env.HARNESS_WORKER_ID);

    simulation.set_fastmode(1);

    const Robots = robotman.loadlist(workerRobots);
    const loadedBrains = Object.values(Robots);
    const botNames = loadedBrains.map(r => r.name);

    const stats = {};
    botNames.forEach(name => {
        stats[name] = { placements: [], health: [], accuracy: [], dcenter: [], lifespan: [] };
    });

    const Options = {
        sim: {
            maxRounds: workerRounds,
            autorestart: 0,
            prestart: 0,
            maxRuntime: false,
            numOfRobots: loadedBrains.length,
            seed: utils.secure_keystring(32),
            defaultBrain: '/* do nothing */',
        },
        arena: {},
        brains: loadedBrains,
        rules: { limit: { round: 60 } },
    };

    const Arena = simulation.Factory(Options);

    Arena.on('determine_round_results', async ({state}) => {
        const placements = state.round.results.robots;
        placements.forEach((place, placeIdx) => {
            place.participants.forEach(p => {
                const s = stats[p.entityName];
                if (!s) return;
                s.placements.push(placeIdx + 1);
                s.health.push(p.health);
                s.accuracy.push(p.accuracy);
                s.dcenter.push(p.dcenter);
                s.lifespan.push(p.lifespan);
            });
        });

        if (!workerQuiet) {
            const roundNum = state.count.rounds;
            const line = placements.map((place, idx) =>
                `${idx + 1}: ${place.participants.map(p => p.entityName).join('/')}`
            ).join('  ');
            process.send({ type: 'round', workerId, roundNum, line });
        }
    });

    Arena.on('roundHasEnded', async () => {
        if (!Arena.state.stopped) return;
        process.send({ type: 'done', workerId, stats, rounds: workerRounds });
        setTimeout(() => process.exit(0), 100);
    });

    Arena.start();

    setTimeout(() => {
        process.send({ type: 'done', workerId, stats, rounds: workerRounds, timeout: true });
        process.exit(1);
    }, 600000);

    return;
}

// ── Parent mode: fork workers and aggregate ──

if (parallel <= 1) {
    // Single-process mode (original behavior)
    const simulation = require('./battle/simulation.js');
    const robotman = require('./robotman.js');
    const logman = require('./logman.js');
    const utils = require('./utils.js');

    simulation.set_fastmode(1);

    const Robots = robotman.loadlist(robotList);
    const loadedBrains = Object.values(Robots);

    if (loadedBrains.length < 2) {
        console.error('Error: need at least 2 robots. Loaded:', Object.keys(Robots).join(', '));
        process.exit(1);
    }

    const botNames = loadedBrains.map(r => r.name);
    console.log(`\n=== Harness: ${rounds} rounds, ${loadedBrains.length} robots ===`);
    console.log(`Robots: ${botNames.join(', ')}\n`);

    const stats = {};
    botNames.forEach(name => {
        stats[name] = { placements: [], health: [], accuracy: [], dcenter: [], lifespan: [] };
    });

    const arenaid = 'harness-' + Date.now();

    const Options = {
        sim: {
            maxRounds: rounds,
            autorestart: 0,
            prestart: 0,
            maxRuntime: false,
            numOfRobots: loadedBrains.length,
            seed: utils.secure_keystring(32),
            defaultBrain: '/* do nothing */',
        },
        arena: {},
        brains: loadedBrains,
        rules: { limit: { round: 60 } },
    };

    const Arena = simulation.Factory(Options);

    Arena.on('simulation_start', async () => {
        logman.json.store_robot_results(arenaid, false);
    });

    Arena.on('determine_round_results', async ({state, Entities}) => {
        logman.csv.store_robot_results(arenaid, state.round.results.robots, Entities.robots);

        const placements = state.round.results.robots;
        placements.forEach((place, placeIdx) => {
            place.participants.forEach(p => {
                const s = stats[p.entityName];
                if (!s) return;
                s.placements.push(placeIdx + 1);
                s.health.push(p.health);
                s.accuracy.push(p.accuracy);
                s.dcenter.push(p.dcenter);
                s.lifespan.push(p.lifespan);
            });
        });

        if (!quiet) {
            const roundNum = state.count.rounds;
            const line = placements.map((place, idx) =>
                `${idx + 1}: ${place.participants.map(p => p.entityName).join('/')}`
            ).join('  ');
            process.stdout.write(`  Round ${String(roundNum).padStart(3)}: ${line}\n`);
        }
    });

    Arena.on('roundHasEnded', async () => {
        if (!Arena.state.stopped) return;
        const elapsed = ((Date.now() - started) / 1000).toFixed(1);
        printSummary(stats, rounds, elapsed);
        console.log('CSV log: static/simlogs/' + arenaid + '.csv');
        process.exit(0);
    });

    const started = Date.now();
    Arena.start();

    setTimeout(() => {
        console.error('\nTimeout after 10 minutes. Rounds completed:', Arena.state.count.rounds);
        process.exit(1);
    }, 600000);

} else {
    // Multi-process mode
    const started = Date.now();
    const numWorkers = Math.min(parallel, rounds);
    const baseRounds = Math.floor(rounds / numWorkers);
    const extraRounds = rounds % numWorkers;

    console.log(`\n=== Harness: ${rounds} rounds, ${robotList.length} robots, ${numWorkers} workers ===`);
    console.log(`Robots: ${robotList.join(', ')}`);
    console.log(`Distribution: ${numWorkers} workers x ~${baseRounds} rounds\n`);

    const workers = [];
    const allStats = {};
    let completedWorkers = 0;
    let totalRoundsCompleted = 0;

    for (let i = 0; i < numWorkers; i++) {
        const workerRounds = baseRounds + (i < extraRounds ? 1 : 0);

        const child = fork(__filename, [], {
            env: {
                ...process.env,
                HARNESS_WORKER: '1',
                HARNESS_WORKER_ID: String(i),
                HARNESS_ROUNDS: String(workerRounds),
                HARNESS_ROBOTS: robotList.join(','),
                HARNESS_QUIET: quiet ? '1' : '0',
            },
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        });

        // Suppress worker stdout/stderr (we get data via IPC)
        child.stdout.on('data', () => {});
        child.stderr.on('data', (d) => {
            const msg = d.toString().trim();
            if (msg) process.stderr.write(`  [worker ${i}] ${msg}\n`);
        });

        child.on('message', (msg) => {
            if (msg.type === 'round' && !quiet) {
                process.stdout.write(`  [w${msg.workerId}] Round ${String(msg.roundNum).padStart(3)}: ${msg.line}\n`);
            }

            if (msg.type === 'done') {
                completedWorkers++;
                totalRoundsCompleted += msg.rounds;

                if (msg.timeout) {
                    console.error(`  [worker ${msg.workerId}] timed out`);
                }

                // Merge stats
                for (const [name, s] of Object.entries(msg.stats)) {
                    if (!allStats[name]) {
                        allStats[name] = { placements: [], health: [], accuracy: [], dcenter: [], lifespan: [] };
                    }
                    allStats[name].placements.push(...s.placements);
                    allStats[name].health.push(...s.health);
                    allStats[name].accuracy.push(...s.accuracy);
                    allStats[name].dcenter.push(...s.dcenter);
                    allStats[name].lifespan.push(...s.lifespan);
                }

                const pct = Math.round(completedWorkers / numWorkers * 100);
                process.stdout.write(`  Worker ${msg.workerId} done (${completedWorkers}/${numWorkers} — ${pct}%)\n`);

                if (completedWorkers === numWorkers) {
                    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
                    printSummary(allStats, totalRoundsCompleted, elapsed);
                    process.exit(0);
                }
            }
        });

        child.on('error', (err) => {
            console.error(`Worker ${i} error:`, err.message);
        });

        workers.push(child);
    }

    // Safety timeout
    setTimeout(() => {
        console.error(`\nParent timeout after 10 minutes. ${completedWorkers}/${numWorkers} workers completed.`);
        workers.forEach(w => w.kill());
        if (Object.keys(allStats).length > 0) {
            const elapsed = ((Date.now() - started) / 1000).toFixed(1);
            printSummary(allStats, totalRoundsCompleted, elapsed);
        }
        process.exit(1);
    }, 600000);
}

// ── Shared output ──

function printSummary(stats, totalRounds, elapsed) {
    console.log('\n' + '='.repeat(95));
    console.log(`RESULTS: ${totalRounds} rounds completed in ${elapsed}s`);
    console.log('='.repeat(95));

    const hdr = [
        pad('Bot', 12),
        pad('1st', 5), pad('2nd', 5), pad('3rd', 5),
        pad('Avg Pl', 8), pad('Health', 8), pad('Accuracy', 10), pad('Dist', 8), pad('Life', 6),
    ].join(' | ');
    console.log(hdr);
    console.log('-'.repeat(hdr.length));

    const sorted = Object.entries(stats)
        .map(([name, s]) => ({ name, s }))
        .sort((a, b) => avg(a.s.placements) - avg(b.s.placements));

    sorted.forEach(({name, s}) => {
        const n = s.placements.length;
        if (n === 0) return;
        const row = [
            pad(name, 12),
            pad(String(s.placements.filter(p => p === 1).length), 5),
            pad(String(s.placements.filter(p => p === 2).length), 5),
            pad(String(s.placements.filter(p => p === 3).length), 5),
            pad(avg(s.placements).toFixed(2), 8),
            pad(avg(s.health).toFixed(1) + '%', 8),
            pad(avg(s.accuracy).toFixed(1) + '%', 10),
            pad(avg(s.dcenter).toFixed(1), 8),
            pad(avg(s.lifespan).toFixed(1), 6),
        ].join(' | ');
        console.log(row);
    });

    console.log('');
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function pad(s, n) { return String(s).padStart(n); }
