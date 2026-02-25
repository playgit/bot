const fs = require('fs');

const { resolve } = require("path");

const utils = require('./utils.js');

const arenaman = require('./arenaman.js');
const robotman = require('./robotman.js');
const procman = require('./procman.js');
const logman = require('./logman.js');

let CompetitionQueue = {}, // queue each Match by compid
    Balancers = {}, // multiserver.js broadcast
    GlobalArenaIDs = []; // derived from multiserver.js broadcast

const dircomp = resolve("./static/compstates/");

procman.on('multiserver.status', (data) => {
    // build a lookup list of all arenas globally
    let Arenas = data.Arenas || [],
        len_Arenas = Arenas.length;
    for (let i=0; i<len_Arenas; i++) {
        GlobalArenaIDs.push(Arenas[i].AID);
    }
    // used to map arenaids to balancer ports
    Balancers = data.Balancers || {};
});

procman.on('compman.queueArenas', (data) => {
    console.log('[compman] received compid', data.payload.compid);
    queueArenas(data.payload.compid, data.payload.Matches);
});

const get_path = (compid) => {
    pathcomp = resolve(dircomp + '/comp' + compid + '.json');
    if (!pathcomp.startsWith(dircomp)) throw Error("invalid path: " + pathcomp);
    return pathcomp;
}

const competitionVersus = (compid, robotlist, matchOptions, arenaOptions) => {
    compid = utils.sanitise_string(compid);

    let pathcomp = get_path(compid);

    let Competition = {},
        broadcast = false;

    if (fs.existsSync(pathcomp)) {
        Competition = JSON.parse(fs.readFileSync(pathcomp));

        if (Competition.completed) {
            Competition.status = 'completed';
            broadcast = false;
        } else {
            Competition.status = 'resume';
            broadcast = true;
        }

    } else {
        // dev: may contain duplicates for robots which are reused
        let robotids = robotlist.replaceAll('\n', ',').replaceAll('\r', ',').split(/(?:,| )+/);

        let robotmetadata = robotman.loadlist(robotids, ['id', 'name', 'team']);

        // deduplicated robot ids
        robotids = Object.keys(robotmetadata);

        // sanity check
        let countrobots = robotids.length;
        if (countrobots < 2)
            throw new Error('[compman] at least two loadable robots required');

        // shuffle robots order
        robotids = utils.shuffleArray(robotids);

        // build groups

        let Groups = {},
            gid = -1;

        robotids.forEach((robotid) => {
            if (gid in Groups && Groups[gid].length < matchOptions.groupMax) {
                Groups[gid].push(robotid)
            } else {
                gid++;
                Groups[gid] = [robotid];
            }
        });

        // build fair matches: GvsG

        let GvsG = {},
            countgroups = Object.values(Groups).length;

        if (countgroups > 1) {
            // remap each group to each other
            Object.entries(Groups).forEach(([idx1, robots1]) => {
                Object.entries(Groups).forEach(([idx2, robots2]) => {
                    if (idx1 == idx2) return true;
                    var key = [
                        utils.num2letters(idx1),
                        utils.num2letters(idx2)].sort().join("-");
                    if (key in GvsG) return true;
                    GvsG[key] = [...robots1, ...robots2];
                });
            });
        } else if (countgroups == 1) {
            // only 1 group and > 1 robot
            GvsG['single'] = Groups[0];
        }

        console.log(
            '[compman]' +
            'robots:', countrobots,
            'groups:', countgroups,
            'matches:', Object.values(GvsG).length,
                GvsG);

        // generate match list and metadata

        let Matches = [],
            arenaids = [],
            lineups = [];

        // shuffle group order
        let shuffled_groups = utils.shuffleArray(Object.entries(GvsG));

        for (const [m_id, m_robotids] of shuffled_groups) {
            let config = {
                'robots': m_robotids,
                // passthru deref
                'matchOptions': JSON.parse(JSON.stringify(matchOptions)),
                'arenaOptions': JSON.parse(JSON.stringify(arenaOptions)),
                'serverOptions': {},
            };

            let arenaid = utils.secure_keystring(32),
                balancerid = utils.balancerid(arenaid);

            config.matchOptions.matchid = m_id;
            config.arenaOptions.arenaid = arenaid;
            config.serverOptions.balancerid = balancerid;

            Matches.push(config);

            // client side data

            arenaids.push(arenaid);

            let m_robotmetadata = [];
            m_robotids.forEach((rid) => m_robotmetadata.push(robotmetadata[rid]));

            lineups.push({
                'arenaid': arenaid,
                'matchid': m_id,
                'robots': m_robotmetadata,
            });
        };

        // persist competition data

        Competition = {
            'compid': compid,
            'created': new Date(),
            'completed': false,
            'balancer_origin': procman.BALANCERID || false,
            'maxRounds': arenaOptions.sim.maxRounds || 1,
            'robots': Object.values(robotmetadata),
            'arenaids': arenaids,
            'lineups': lineups,
            'Matches': Matches,
        }

        fs.writeFileSync(pathcomp, JSON.stringify(Competition, null, 2));

        Competition.status = 'new';
        broadcast = true;
    }

    console.log(
        '[compman]', Competition.compid, Competition.status,
        'broadcast:', broadcast);

    if (broadcast) {
        // broadcast via parent
        procman.send_to_parent({
            type: 'compman.queueArenas',
            payload: {
                compid: compid,
                Matches: Competition.Matches,
            },
        });
    }

    return Competition;
}

const competitionStatus = (() => {
    // cache: reduce hit on disk i/o
    let cache = {};

    return (compid) => {
        compid = utils.sanitise_string(compid);

        // cache: reduce hit on disk i/o
        let now = (new Date()).getTime();
        if (compid in cache) {
            let diff = now - cache[compid][0];
            if (diff < 3000) {
                console.log(
                    '[compman] using cache',
                    compid, '(' + diff + ')');
                return cache[compid][1];
            }
        }

        // competition configuration file must exist
        let pathcomp = get_path(compid);
        if (fs.existsSync(pathcomp)) {
            Competition = JSON.parse(fs.readFileSync(pathcomp));
        } else {
            return false;
        }

        // prepopulate from initial competition configuration

        let results = {
            'created'  : Competition.created || false,
            'completed': Competition.completed,
            'maxRounds': Competition.maxRounds,
            'byArenas' : {},
            'byRobots' : {},
            'balancerByArenaID': {},
        };

        Competition.lineups.forEach(L => {
            results.byArenas[L.arenaid] = L;
            // dev: useful when running local servers
            let balancerid = utils.balancerid(L.arenaid),
                [port, ts] = Balancers[balancerid] || [false, false];
            results.balancerByArenaID[L.arenaid] = [balancerid, port]
        });

        // iterate through each arena
        Competition.arenaids.forEach((arenaid) => {
            completedRounds = logman.json.read_robot_results(arenaid);
            // initialise extra data in lineups
            results.byArenas[arenaid].rounds = 0;
            // === false (no .json) when not yet .start(ed), skip for later
            if (completedRounds === false) return false;
            // mark this lineup as started, probably in-progress
            results.byArenas[arenaid].started = true;
            // build reference lookup for robots in lineup
            // dev: makes it easier for later referencing
            let lookuprobots = {};
            results.byArenas[arenaid].robots.forEach(
                r => lookuprobots[r.id] = r);
            // iterate through each round
            completedRounds.forEach((round, roundidx) => {
                // prevent extra rounds from affecting ranking
                if (roundidx > results.maxRounds) return;
                // increment round counter
                results.byArenas[arenaid].rounds++;
                // iterate through each placing
                for (const [place, placeMetadata]
                        of Object.entries(round.placements)) {
                    // base points: 1st place = 1; 2nd place = 2; etc
                    let points = parseInt(place) + 1;
                    // penalise ties by number of robots sharing the tie
                    if (placeMetadata.decision == 'tie') {
                        points += placeMetadata.participants.length;
                    }
                    // robots accumulate points
                    placeMetadata.participants.forEach(robot => {
                        // COMPAT: results structures
                        let rname = false,
                            rteam = false,
                            rid = false;
                        if (robot.entityName) {
                            // dev: v2 format
                            rname   = robot.entityName;
                            rteam   = robot.entityTeam;
                            rid     = robot.entityID;
                        } else if (Array.isArray(robot)) {
                            // dev: v1 format: order-sensitive array
                            rname   = robot[0];
                            rteam   = robot[1];
                            rid     = robot[8];
                        } else {
                            throw new TypeError('unknown results structure');
                        }
                        // END COMPAT: results structures
                        // generate/update results.byRobots
                        if (rid in results.byRobots) {
                            // results.byRobots[rid][0] += points;
                            // results.byRobots[rid][4]++;
                            results.byRobots[rid].points += points;
                            results.byRobots[rid].rounds++;
                        } else {
                            // results.byRobots[rid] = [
                            //     points, rid, rname, rteam, 1];
                            results.byRobots[rid] = {
                                points      : points,
                                entityID    : rid,
                                entityName  : rname,
                                entityTeam  : rteam,
                                rounds      : 1,
                            };
                        }
                        // accumulate in .byArenas as well
                        try {
                            lookuprobots[rid].score = (
                                lookuprobots[rid].score || 0) + points;
                        } catch(err) {
                            console.log(
                                '[compman] lookup failed',
                                arenaid, rid, err);
                        }
                    });
                } // forEach (placing)
            }); // forEach (round)
        }) // forEach (arenaid)

        // sort by average rank
        results.byRobots = Object.values(results.byRobots).sort(
            (a, b) => (
                (a.points / a.rounds) > (b.points / b.rounds) ?  1 :
                (a.points / a.rounds) < (b.points / b.rounds) ? -1 : 0));

        results.byArenas = Object.values(results.byArenas);

        // cache: reduce hit on disk i/o
        cache[compid] = [now, results];

        return results;
    }
})();

const queueArenas = (compid, Matches) => {
    // responds to broadcast from parent process
    // runs on multiple balancers
    // dev: is not aware of global states

    // index in-memory Matches
    let lookup_arenaids = [],
        matchQueue = CompetitionQueue[compid] || [],
        len_matchQueue = matchQueue.length;
    for (let i=0; i<len_matchQueue; i++) {
        lookup_arenaids.push(matchQueue[i].arenaOptions.arenaid);
    }

    Matches.forEach((Match) => {
        if (Match.serverOptions.balancerid != procman.BALANCERID) return;

        if (lookup_arenaids.includes(Match.arenaOptions.arenaid)) {
            // state: current match is queued
            // do nothing, queue will proceed as usual
            console.log(
                '[' + procman.BALANCERID + '::compman]'+
                '[' + compid + ']',
                'waiting:', Match.arenaOptions.arenaid,
            );
        } else {
            // state: current match not in queue
            // try to determine current state
            let rounds = logman.json.read_robot_results(
                Match.arenaOptions.arenaid);
            if (rounds) {
                // state: previous rounds exist
                let completed = rounds.length,
                    maxRounds = Match.arenaOptions.sim.maxRounds;
                if (completed == maxRounds) {
                    // state: ran, and was completed
                    // nothing needs to be done
                    console.log(
                        '[' + procman.BALANCERID + '::compman]'+
                        '[' + compid + ']',
                        'completed:', Match.arenaOptions.arenaid,
                    );
                } else {
                    // state: ran, and not complete
                    // initialise remaining rounds
                    Match.arenaOptions.sim.maxRounds -= completed;
                    Match.simulation = arenaman.Arena.serverside(
                        Match.robots,
                        Match.arenaOptions,
                    );
                    CompetitionQueue[compid] = (CompetitionQueue[compid] || [])
                    CompetitionQueue[compid].push(Match);
                    console.log(
                        '[' + procman.BALANCERID + '::compman]'+
                        '[' + compid + ']',
                        'resume:', Match.arenaOptions.arenaid,
                        'left:', maxRounds,
                    );
                }
            } else {
                // state: entirely new - no previous rounds
                // reserve the arena, but dont start it yet
                // dev: prevents somebody from taking over the arena id
                Match.simulation = arenaman.Arena.serverside(
                    Match.robots,
                    Match.arenaOptions,
                );
                CompetitionQueue[compid] = (CompetitionQueue[compid] || [])
                CompetitionQueue[compid].push(Match);
                console.log(
                    '[' + procman.BALANCERID + '::compman]' +
                    '[' + compid + ']',
                    'new:', Match.arenaOptions.arenaid,
                );
            }
        }
    });
}

const check_competition_completion = () => {
    // file-based mechanism to retrieve competitions
    let filenames = fs.readdirSync(dircomp, {withFileTypes: true})
        .filter(item => !item.isDirectory() && item.name.endsWith('.json'))
        .map(item => item.name);

    filenames.forEach(filename => {
        let pathcomp = dircomp + '/' + filename,
            Competition = JSON.parse(fs.readFileSync(pathcomp));

        if (Competition.completed) {
            // no further checking required, skip
            return;
        }

        balancer_origin = Competition.balancer_origin || '1';

        if (procman.BALANCERID &&
                balancer_origin != procman.BALANCERID) {
            // only process the file on the same origin process
            return;
        }

        // count rounds for each arena
        let incomplete = [],
            len_arenaids = Competition.arenaids.length;

        for (let i=0; i<len_arenaids; i++) {
            let arenaid = Competition.arenaids[i],
                len_rounds = (
                    logman.json.read_robot_results(arenaid) ||
                    []).length;

            if (len_rounds < Competition.maxRounds) {
                incomplete.push(arenaid);
            }
        };

        let len_incomplete = incomplete.length;

        if (len_incomplete == 0) {
            // update the file with completion date
            Competition.completed = new Date()
            fs.writeFileSync(pathcomp, JSON.stringify(Competition, null, 2));
            console.log('[compman] competition completed', Competition.compid);
        } else {
            // check if we should restart competition, arenas
            // do incomplete competition arenas exist elsewhere?
            // dev: ignore completed to prevent unnecessary rebroadcast
            let missing_arenaids = [];
            for (let i=0; i<len_incomplete; i++) {
                let incomplete_arenaid = incomplete[i];
                if (!GlobalArenaIDs.includes(incomplete_arenaid)) {
                    missing_arenaids.push(incomplete_arenaid);
                }
            }
            if (missing_arenaids.length > 0) {
                console.log(
                    '[compman] rebroadcasting', Competition.compid,
                    'missing:', missing_arenaids);
                // rebroadcast to all load-balancers
                // will be filtered by queueArenas at each balancer
                procman.send_to_parent({
                    type: 'compman.queueArenas',
                    payload: {
                        compid: Competition.compid,
                        Matches: Competition.Matches
                    },
                });
            }
        }
    });
}

const process_local_arena_queue = (() => {
    // prevent noisy logging
    let logQueueEmpty = false;
    let logActiveMatch = false;

    return () => {
        // process this instance competition queues
        // ...until everything is completed

        let compids = Object.keys(CompetitionQueue),
            len_compids = compids.length;

        for (var i=0; i<len_compids; i++) {
            let compid = compids[i];

            let Queue = CompetitionQueue[compid];

            if (Queue.length > 0) {
                logQueueEmpty = false;

                // resolve the queue
                let Match = Queue[0];

                if (Match.simulation.state.started) {
                    if (Match.simulation.state.stopped) {
                        // sim has finished
                        Queue.shift();
                        logActiveMatch = false;
                    } else {
                        if (logActiveMatch) {
                            console.log(
                                '[' + procman.BALANCERID + '::compman]' +
                                '[' + compid + ']',
                                'active match:',
                                    Match.arenaOptions.arenaid)
                        }
                        // sim still running
                        // update states
                    }
                } else {
                    // new sim
                    Match.simulation.start();
                    logActiveMatch = false;
                }
            } else {
                if (!logQueueEmpty) {
                    // one-off log only
                    logQueueEmpty = true;
                    console.log(
                        '[' + procman.BALANCERID + '::compman]' +
                        '[' + compid + ']',
                        'queue empty'
                    );
                }
            }

        } // end for (compids)
    }
})();

setInterval(() => {
    process_local_arena_queue();
    check_competition_completion();
}, 3000);

module.exports = {
    competitionVersus: competitionVersus,
    queueArenas: queueArenas,
    status: competitionStatus,
};
