const numCPUs = require("os").cpus().length;

const { fork } = require('node:child_process');

/* external config */

const dotenv = require('dotenv');

dotenv.config();

let APIKEY = process.env.APIKEY || "";
let PORT = parseInt(process.env.PORT) || 5000;
let PROCS = Math.min(numCPUs, parseInt(process.env.PROCS) || numCPUs);

console.log("[multi] starting", PROCS, "processes...");

let Processes = {}; // index by port
let Heartbeats = {}; // index by port

let Balancers= {};  // index by multiserver.js balancerid
let SockmanStates = {}; // index by client-side BALANCERID

/* initilisation and recovery */

const fork_child_process = (listen, balancerid) => {
    console.log('[multi] fork', listen);

    let ts_fork = (new Date()).getTime(),
        str_listen = String(listen); // string for consistency

    // store port and time of fork
    Balancers[balancerid] = [listen, ts_fork];

    let proc = fork('server.js', {
        'env': {
            "APIKEY": APIKEY,
            "PORT": listen,
            "MULTINODE": 1,
            "BALANCERID": balancerid,
        },
        'silent': true,
        'detached': false
    });

    // capture and output stdio, stderr

    proc.stdio[1].on('data', (data) => {
        Heartbeats[str_listen] = [new Date(), balancerid, ts_fork];

        console.log(
              "[multi][" + listen + ":stdout]"
            + data.toString().trim());
    });

    proc.stdio[2].on('data', (data) => {
        Heartbeats[str_listen] = [new Date(), balancerid, ts_fork];

        console.log(
              "[multi][" + listen + ":stderr]"
            + data.toString().trim());
    });

    // child -> parent IPC handlers

    proc.on('message', data => {
        Heartbeats[str_listen] = [new Date(), balancerid, ts_fork];

        if (data.type == "sockman.status") {
            SockmanStates[data.BALANCERID] = [listen, data];
        } else if (data.type == "sockman.deregisterArena") {
            // send only to process with actual arena
            send_by_arenaid(data, data.arenaid);
        } else if (data.type == "sockman.arenaDeregistered") {
            send_to_all(data);
        } else if (data.type == "compman.queueArenas") {
            send_to_all(data);
        } else if (data.type == "procman.terminateBalancer") {
            send_to_all(data);
        } else {
            console.log("[multi] unhandled IPC", data.type);
        }
    });

    // recover dead processes

    proc.on('close', () => {
        console.log("[multi] process died", listen);

        delete Processes[listen];

        Processes[listen] = fork_child_process(listen, balancerid);
    });

    return proc;
}

for (var idx=0; idx<PROCS; idx++) {
    ((idx) => {
        const listen = PORT + idx;
        const prockey = '' + listen;
        const balancerid = idx + 1;

        Processes[prockey] = fork_child_process(listen, balancerid);
    })(idx);
};

/* IPC message sending */

const send_by_arenaid = (payload, arenaid) => {
    // iterate through all processes
    var entries = Object.entries(SockmanStates);
    for (var i=0; i<entries.length; i++) {
        const [_, [listen, Status]] = entries[i];
        // iterate arena list and locate it
        for (var j=0; j<Status.Arenas.length; j++) {
            if (Status.Arenas[j].AID == arenaid) {
                let prockey = '' + listen,
                    P = Processes[prockey];

                if (P && P.send) {
                    P.send(payload)
                } else {
                    console.log(
                        "[multi] unresponsive arena process",
                        prockey)
                }

                break;
            }
        } // end for(Arenas)

        /* continue scanning - in rare situatiuons (load balancer
            change), duplicate arenas might remain using old
            load balancer configuration, therefore send to all
            found instances (esp. deregisterArena) */

    } // end for(Status/Processes)
}

const send_to_all = (payload) => {
    for (const [prockey, P] of Object.entries(Processes)) {
        if (P && P.send) {
            P.send(payload)
        } else {
            console.log("[multi] unresponsive child", prockey)
        }
    };
}

/* state sharing */

const broadcast_status = () => {
    let consolidated = {
        "type": "multiserver.status",
        "Heartbeats": {},
        "Arenas": [],
        "RoboSockets": {},
        "ViewerSockets": {},
        "Balancers": Balancers,
    };

    let SockmanEntries = Object.entries(SockmanStates),
        len_SockmanEntries = SockmanEntries.length;
    for (let i=0; i<len_SockmanEntries; i++) {
        let [BALANCERID, [listen, Status]] = SockmanEntries[i];

        // arenas - add source balancer id and port
        let Arenas = Object.values(Status.Arenas);
            len_Arenas = Arenas.length;
        for (let j=0; j<len_Arenas; j++) {
            let arena = Arenas[j];
            arena["source.BALANCERID"] = BALANCERID;
            arena["source.port"] = listen;
        };
        consolidated.Arenas = consolidated.Arenas.concat(Status.Arenas);

        // robot sockets
        let RoboSockEntries = Object.entries(Status.RoboSockets),
            len_RoboSockEntries = RoboSockEntries.length;
        for (let j=0; j<len_RoboSockEntries; j++) {
            let [arenaid, Sockets] = RoboSockEntries[j];

            if (arenaid in consolidated.RoboSockets) {
                consolidated.RoboSockets[arenaid] = {
                    ...consolidated.RoboSockets[arenaid],
                    ...Sockets}
                console.log(
                    "[multi] RoboSockets duplicate:",
                    BALANCERID, arenaid);
            } else {
                consolidated.RoboSockets[arenaid] = Sockets;
            }
        }

        // viewer sockets
        let ViewerSockEntries = Object.entries(Status.ViewerSockets),
            len_ViewerSockEntries = ViewerSockEntries.length;
        for (let j=0; j<len_ViewerSockEntries; j++) {
            let [arenaid, Sockets] = ViewerSockEntries[j];

            if (arenaid in consolidated.ViewerSockets) {
                consolidated.ViewerSockets[arenaid] = {
                    ...consolidated.ViewerSockets[arenaid],
                    ...Sockets}
                console.log(
                    "[multi] ViewerSockets duplicate:",
                    BALANCERID, arenaid);
            } else {
                consolidated.ViewerSockets[arenaid] = Sockets;
            }
        }

        // extra: heartbeats
        consolidated.Heartbeats = Heartbeats;
    }

    send_to_all(consolidated);
}

setInterval(broadcast_status, 3000);
