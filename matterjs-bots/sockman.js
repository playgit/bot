const utils = require('./utils.js');

const arenaman = require('./arenaman.js');

let io = false;

let ViewerSockets = {};
let RoboSockets = {};

let Events = {};

const on = (() => {
    let counter = 0;
    return (event, func) => {
        Events[event] = (Events[event] || {});
        Events[event][counter] = func;
        counter++;
        console.log('[sockman] registered event', event, counter);
        return counter;
    }
})();

/* arena, viewers and robot managers */

const attach_sockets = (Arena, socketroom) => {
    if (Arena._socketman) {
        console.log('[sockman] room already created', socketroom);
        return;
    }
    Arena._socketman = new Date();
    console.log('[sockman] setting room', socketroom)

    isNotRealtime = !Arena.settings.sim.realtime;

    Arena.on('simulation_start.top', async () => {
        // dev: required for subsequent rounds
        io.to(socketroom).emit('reset state', Arena.state_base);
    });

    Arena.on('simulation_start', async () => {
        io.to(socketroom).emit('simulation start', {});
    });

    Arena.on('roundHasEnded', async () => {
        io.to(socketroom).emit('simulation end', {});
    });

    Arena.on('simulation_stop', async () => {
        io.to(socketroom).emit('simulation stop', {});
    });

    Arena.on('detect_projectile_hit.hit', async ({extras}) => {
        if (isNotRealtime) return;
        io.to(socketroom).emit('robot hit',  {
            id  : extras.r0.id,
            x   : extras.r0.position.x,
            y   : extras.r0.position.y,
        });
    });

    Arena.on('detect_wall_collision.hit', async ({extras}) => {
        if (isNotRealtime) return;
        io.to(socketroom).emit('robot wall',  {
            id  : extras.r0.id,
            x   : extras.r0.position.x,
            y   : extras.r0.position.y,
        });
    });

    Arena.on('detect_robot_collision.hit', async ({extras}) => {
        if (isNotRealtime) return;
        io.to(socketroom).emit('robot robot',  {
            id1 : extras.r0.id,
            x1  : extras.r0.position.x,
            y1  : extras.r0.position.y,
            id2 : extras.r1.id,
            x2  : extras.r1.position.x,
            y2  : extras.r1.position.y,
        });
    });

    Arena.on('launch_projectile.launch', async ({extras}) => {
        if (isNotRealtime) return;
        io.to(socketroom).emit('robot launch',  {
            id  : extras.b0.id,
            x   : extras.b0.position.x,
            y   : extras.b0.position.y,
        });
    });

    Arena.on('knockout_robot', async ({extras}) => {
        if (isNotRealtime) return;
        io.to(socketroom).emit('robot knockout', {
            id  : extras.r0.id,
            x   : extras.r0.position.x,
            y   : extras.r0.position.y,
        });
    });

    Arena.on('shock_robot', async ({extras}) => {
        if (isNotRealtime) return;
        io.to(socketroom).emit('robot shock', {
            id  : extras.r0.id,
            x   : extras.r0.position.x,
            y   : extras.r0.position.y,
        });
    });

    Arena.on('simulation_tick.0', async () => {
        if (isNotRealtime) return;
        io.to(socketroom).emit('battle start', {});
    });

    let ts_updated = 0;

    Arena.on('status_updates', async ({extras}) => {
        if (isNotRealtime || extras.st.ro.rs) {
            // dev: throttle output when not real-time
            //  or when results available
            let ts_now = (new Date).getTime();
            if (ts_now - ts_updated < 333) return;
            ts_updated = ts_now;
        }

        io.to(socketroom).emit('update state', extras);
    });
};

const registerArena = (data) => {
    let arenaid = data.arenaid,
        isCreated = false,
        Arena = arenaman.get(arenaid);

    let reserved = arenaid.length > 30;

    if (Arena) {
        if (
            // XXX: no 'locked' use case
            !Arena.settings.sim.locked
            // compman arenas are reserved
            && !reserved
            && (
                // explicit user request
                parseInt(data.extras.forceNew) == 1
                // sim maxRounds, maxRuntime reached
                // dev: restarts simulation
                || (Arena.state.status ==
                    Arena.code_lookup['status']['completed'])
            )
        ) {
            // respect locked and reserved arenas and prevent takeovers
            deregisterArena(arenaid);
            Arena = false;
        } else {
            console.log("[sockman] existing arena", arenaid);
        }
    }

    // standard arenas must have ids of 30 chars or less
    if (!Arena && !reserved) {
        let arenaConfig = Object.assign({
            'arenaid': arenaid,
            'clientConnection': () => clientConnector(arenaid),
        }, data.extras || {});

        Arena = arenaman.Arena.multipurpose(arenaConfig)

        if (!Arena.start) {
            // XXX: handle odd error where Arena "goes away"
            // force terminate arena and any sockets
            deregisterArena(arenaid, true)
            return false;
        }

        console.log("[sockman] new standard arena", arenaid);

        isCreated = true;
    } else if (!Arena && reserved) {
        console.log("[sockman] reserved arena not found", arenaid);
    } else if (Arena && reserved) {
        console.log("[sockman] reserved arena", arenaid);
    }

    if (Arena){
        // new client-initiated OR server-initiated arena
        attach_sockets(Arena, arenaid);

        if (!Arena.state.started) {
            if (reserved) {
                // might be a compman arena
                // will be started via other means
            } else {
                Arena.start();
            }
        }

        // prepare to track sockets
        if (!(arenaid in RoboSockets)) RoboSockets[arenaid] = {};
        if (!(arenaid in ViewerSockets)) ViewerSockets[arenaid] = {};

        if (Events.arenaRegistered) {
            Object.values(Events.arenaRegistered).forEach(
                f => f({
                    isCreated: isCreated,
                    arenaid: arenaid,
                    Arena: Arena
                }))
            ;
        }
    }

    return Arena;
}

const deregisterArena = (arenaid, force) => {
    if (!arenaman.get(arenaid) && !force) return false;

    arenaman.remove(arenaid);

    var count_viewers = terminateSockets(ViewerSockets, arenaid, "keys");
    var count_robots = terminateSockets(RoboSockets, arenaid, "values");

    console.log("[sockman] terminated viewers and robots",
        count_viewers, count_robots)

    if (Events.arenaDeregistered) {
        Object.values(Events.arenaDeregistered).forEach(
            f => f({
                arenaid: arenaid
            })
        );
    }

    return true;
}

const registerRobot = (socket) => {
    let arenaid = socket.handshake.query.arenaid;

    // check: Arena must exist
    var Arena = arenaman.get(arenaid);
    if (!Arena) return false;

    if (!(arenaid in RoboSockets)) RoboSockets[arenaid] = {};

    // auto-assign a 1-indexed debug key in the first available slot
    // limited by Arena.settings.sim.numOfRobots

    let maxCount = Arena.settings.sim.numOfRobots + 1;
    let assignedKey = false;
    for(var i=1; i < maxCount ; i++){
        let robokey = "Debug " + i;
        if (!(robokey in RoboSockets[arenaid])) {
            assignedKey = robokey;
            break;
        }
    }

    if (assignedKey){
        RoboSockets[arenaid][assignedKey] = socket.id;
        console.log("[sockman] robot assigned", arenaid, assignedKey);
        return assignedKey;
    } else {
        console.log("[sockman] no robot slots", arenaid);
        return false;
    }
}

const registerViewer = (socket, arenaid) => {
    // check: Arena must exist
    var Arena = arenaman.get(arenaid);
    if (!Arena) return false;

    if (!(arenaid in ViewerSockets)) ViewerSockets[arenaid] = {};
    ViewerSockets[arenaid][socket.id] = new Date();
}

/* socket connection handlers */

const clientConnector = (arenaid) => {
    return (context_state) => {
        if (!(arenaid in RoboSockets)) {
            throw {
                code: "missing",
                message: "arena id not found"
            }
        }

        if (!(context_state.name in RoboSockets[arenaid])) {
            throw {
                code: "missing",
                message: "robot id not found"
            }
        }

        var socketid = RoboSockets[arenaid][context_state.name];

        var socket = io.sockets.sockets.get(socketid);

        if (!socket) {
            throw {
                code: "missing",
                message: "robot socket invalid"
            }
        }

        return socket;
    }
}

const terminateSockets = (Collection, arenaid, By) => {
    let count = 0;
    if (arenaid in Collection){
        var keys = Object[By](Collection[arenaid]);
        count = keys.length;
        keys.forEach(socketid => {
            var socket = io.sockets.sockets.get(socketid);

            if (socket) socket.disconnect();

            delete Collection[arenaid][socketid];
        });
        delete Collection[arenaid];
    }
    return count;
}

const onRobotConnection = socket => {
    // dev: socket.id changes on each (re)connection
    console.log("[sockman] robot connected", socket.id);

    // construct key from handshake
    // socket.handshake.query.iamarobot
    let robokey = registerRobot(socket);

    socket.emit("robolink");

    socket.on("disconnect", (reason) => {
        let arenaid = socket.handshake.query.arenaid;

        console.log(
            "robot disconnected", arenaid, robokey,
            "reason:", reason);

        if (arenaid in RoboSockets)
            delete RoboSockets[arenaid][robokey];
    });
}

const onViewerConnection = socket => {
    console.log("[sockman] viewer connected", socket.id);

    let arenaid = false,
        Arena = false;

    // from: arena.init.js::connect
    socket.on("register", (data, cb) => {
        Arena = registerArena(data);

        if (Arena) {
            arenaid = data.arenaid;

            socket.join(arenaid);
            registerViewer(socket, arenaid);

            // dev: required for new client connection
            cb(Arena.state_base);
        } else {
            cb({
                fE: false,
                cl: false,
                st: false, // "Arena unavailable" on client
            });
        }
    });

    socket.on("debug all spread", coordinates => {
        Arena.debug_all_spread(coordinates);
    });

    socket.on("debug all rotate left", () => {
        Arena.debug_all_rotate_left();
    });

    socket.on("debug all rotate right", () => {
        Arena.debug_all_rotate_right();
    });

    socket.on("debug all forward", () => {
        Arena.debug_all_move_forward();
    });

    socket.on("debug sim restart", () => {
        Arena.start();
    });

    socket.on("debug sim toggle pause", () => {
        Arena.pause();
    });

    socket.on("debug sim unpause", () => {
        Arena.pause(false);
    });

    socket.on("debug all face center", () => {
        Arena.debug_all_face_center();
    });

    socket.on("debug all fire", () => {
        Arena.debug_all_fire();
    });

    socket.on("disconnect", async (reason) => {
        console.log("viewer disconnected, reason:", reason);

        if (arenaid in ViewerSockets)
            delete ViewerSockets[arenaid][socket.id];
    });
}

const init = socketio => {
    io = socketio;

    io.on("connection", socket => {
        if (socket.handshake.query.arenaid) {
            // verify we are on the correct balancer
            // dev: reduces issues from load balancer config changes

            let server_balancerid = utils.balancerid(
                    socket.handshake.query.arenaid),
                client_balancerid = socket.handshake.query.balancerid;

            if (server_balancerid != client_balancerid) {
                socket.emit('balancerid.mismatch', {
                    'server': server_balancerid,
                    'client': client_balancerid,
                });
                console.log(
                    '[sockman] mismatched balancerid',
                    server_balancerid, client_balancerid);
            }
        }

        if ("iamarobot" in socket.handshake.query) {
            // from: RobotControlPanel.js::initSocket
            onRobotConnection(socket);
        } else {
            // arena
            onViewerConnection(socket);
        }
    });

    console.log("[sockman] init");
}

const metadata_arenas = () => {
    let collection = [];

    for (const [arenaid, Arena] of Object.entries(arenaman.Arenas)) {
        let metadata = {
            "AID": arenaid,
            "IID": Arena.settings.sim.IID,
            "arenaAge": ((new Date()).getTime() -
                Arena.settings.sim.created.getTime()) / 1000,
            "created": Arena.settings.sim.created,
            "balancerid": utils.balancerid(arenaid),
        };

        let viewer = {
            "first": false,
            "last": false,
            "count": 0};

        if (arenaid in ViewerSockets) {
            for (const [_, datetime]
                    of Object.entries(ViewerSockets[arenaid])) {

                if (viewer.first === false ||
                        viewer.first > datetime)
                            viewer.first = datetime;
                if (viewer.last === false ||
                        viewer.last < datetime)
                            viewer.last = datetime;
            };
            viewer.count = Object.keys(ViewerSockets[arenaid]).length;
        }

        metadata["activeViewers"] = viewer;

        collection.push(metadata);
    }

    return collection;
}

const instance_status = () => {
    // !!! returns privileged info

    let status = {
        "now": new Date(),
        "type": "sockman.status",
        "Arenas": metadata_arenas(),
        "RoboSockets": RoboSockets,
        "ViewerSockets": ViewerSockets
    };

    return status;
}

const scrub_status = (status) => {
    let deref = JSON.parse(JSON.stringify(status));

    deref.Arenas.forEach(arena => arena.AID="XXXXXX");
    delete deref.RoboSockets;
    delete deref.ViewerSockets;

    return deref;
}

module.exports = {
    RoboSockets: RoboSockets,
    ViewerSockets: ViewerSockets,

    init: init,
    on: on,

    deregisterArena: deregisterArena,

    instance_status: instance_status,
    scrub_status: scrub_status,
};
