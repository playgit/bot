(() => {
window.addEventListener('load', () => {

let balancerid = window.balancerid || "", // load-balancer
    arenaid = window.location.pathname.split("/arena/").pop();
    arenaparams = (window.__POST ||
        Object.fromEntries(new URLSearchParams(
            window.location.search.substring(1))));

var io_settings = {
    transports: ["websocket"],
    query: {
        balancerid: balancerid,
        arenaid: arenaid,
    }
};

const socket = io(io_settings);

const arenaAudio = createArenaAudio();

let // set once per round
    worldState = false,
    // updated every frame
    fps_last = false,
    fps_count = 0,
    fps_every = 3,
    arenaState = false;

const update_world_line = async () => {
    let statusSimulation = document.querySelectorAll(
        '.simulation-state .world');
    if ('__REPLAY' in window && window.__REPLAY) {
        statusSimulation.forEach(el => {
            el.innerText = 'replay';
        });
    } else {
        let started = new Date(worldState.started),
            ts_now = (new Date).getTime(),
            ts_started = started.getTime(),
            mleft = (worldState.limit.runtime
                ? Math.floor(
                    ((ts_started + (worldState.limit.runtime * 1000) -
                        ts_now) / 60000))
                : '&infin;'),
            rleft = (worldState.limit.rounds
                ? worldState.limit.rounds - worldState.count.rounds
                : '&infin;');
        statusSimulation.forEach(el =>{
            el.innerHTML =
                '<b>live</b> left: ' +
                mleft + 'm, ' +
                rleft + 'r ';
        });
    }
};

const update_fps_line = async() => {
    let ms = fps_every * 1000,
        ts_now = (new Date()).getTime();
    if (ts_now - (fps_last || ts_now) > ms) {
        let framerate = fps_count/(ts_now - fps_last) * 1000;
        document
            .querySelectorAll('.simulation-state .fps')
            .forEach(el => {
                el.innerText = framerate.toFixed(1) + 'fps';
            });
        fps_last = false;
    }
    if (!fps_last) {
        fps_count = 0;
        fps_last = ts_now
    }
    fps_count++;
}

const update_arena_line = async() => {
    document
        .querySelectorAll('.simulation-state .arena')
        .forEach(el => {
            el.innerHTML = '<b>' + arenaState.text_status + '</b> ' +
                'frame: ' + arenaState.co.fr + ' ' +
                'secs: ' + arenaState.co.se.toFixed(2);
        });
}

const handle_completed_arena = async () => {
    if (arenaState.text_status == 'completed') {
        // trigger once only
        if (worldState._notify_complete) return;
        worldState._notify_complete = true;
        window.__Notifications.show({
            type: 'simulation',
            message:
                '<b>Simulation completed.</b> ' +
                'You can head back to the ' +
                    '<a class="link dim dark-blue" href="/">' +
                    'front page</a>. ' +
                'Reconnecting to check in ' +
                    '<span id="-autorefresh">60</span>s.',
            css: 'black bg-green',
        });
        socket.disconnect();
        let reconnection = false;
        reconnection = setInterval(() => {
            let el = document.getElementById('-autorefresh'),
                countdown = parseInt(el.innerText);
            countdown--;
            el.innerText = countdown;
            if (countdown == 0) {
                clearInterval(reconnection);
                socket.connect();
            }
        }, 1000);
    };
};

const set_world_state = (state) => {
    worldState = state;
    update_world_line();
    console.log('world state set', worldState);
};

const set_code_lookups = (fE, cl) => {
    entities_lookup = {};
    fE.forEach(e => { entities_lookup[e.id] = e; });
    Lookups.register('Entities', entities_lookup);

    Lookups.register('damage', cl.damage);

    Lookups.register('status',
    Object.entries(cl.status)
        .reduce((A, [k, v]) => (A[v] = k, A), {}));
}

const set_arena_state = (state) => {
    arenaState = state;
    arenaState.text_status = Lookups.get('status', state.sa);

    update_fps_line();
    update_arena_line();
    handle_completed_arena();
};

const set_sim_state = (() => {
    let prev = false;
    return (status) => {
        if (status == prev) return; // no change
        prev = status;

        let statusOnline = document.querySelectorAll(
                '.simulation-state .online'),
            statusFPS = document.querySelectorAll(
                '.simulation-state .fps');

        if (status == 'online') {
            statusOnline.forEach(el => {
                el.classList.add('green');
                el.classList.remove('yellow', 'red');
            });
        } else if (status == 'ready') {
            statusOnline.forEach(el => {
                el.classList.add('yellow');
                el.classList.remove('green', 'red');
            });
            statusFPS.forEach(el => {
                el.innerText = 'ready';
            });
        } else if (status == 'disconnected') {
            statusOnline.forEach(el => {
                el.classList.add('red');
                el.classList.remove('green', 'yellow');
            });
            statusFPS.forEach(el => {
                el.innerText = 'NA';
            });
        }
    }
})();

set_sim_state('disconnected');


/* state sync */

const states_init = ({fE, cl, st}) => {
    // init client registers
    arenaState = false;

    // [f]ixed[E]ntities
    // [c]ode[l]ookups (.damage, .status)
    set_code_lookups(fE, cl);

    window.__Renderer.reset_visuals();
    window.__Renderer.set_canvas(
        st.arena.width, st.arena.height,
        st.arena.wall);
    window.__Renderer.set_edges(
        'robot', st.RP);

    set_world_state(st);

    set_sim_state('ready');

    OverlayManager.reset();

    console.log("states initialised");
};

const states_update = ({ro, pr, se, st, wa}, options) => {
    // sent by simulation.js
    //  [ro]bots
    //  [wa]lls
    //  [pr]ojectiles
    //  [se]nsors
    //  [st]atus

    set_sim_state('online');

    set_arena_state(st);

    OverlayManager.atFrame(st.co.fr);

    window.__Renderer.render_frame(
        ro, pr, se, wa,
        arenaState, worldState,
        options);

    window.__Sidebar.render(ro);
};

/* arena audio */

arenaAudio.attach(document.querySelectorAll('.audio-toggle'));

/* socket events */

const is_realtime = () => {
    return !!worldState.realtime;
}

const get_arena_status = () => {
    return arenaState.text_status
}

socket.on("connect", () => {
    console.log("server connected");

    let clonedparams = JSON.parse(JSON.stringify(arenaparams));

    if (clonedparams['forceNew'] == 1 && window.IGNORE_FORCE_NEW_ONCE) {
        delete clonedparams['forceNew'];
        window.IGNORE_FORCE_NEW_ONCE = false;
        console.log('temporarily ignoring forceNew directive');
    };

    socket.emit(
        "register", {
            arenaid: arenaid,
            extras: clonedparams,
        },
        // [f]ixed[E]ntities
        // [d]amage[C]odes
        // [s]tate
        ({fE, cl, st}) => {
            if (st) {
                window.__Notifications.clear('simulation');
            } else {
                window.__Notifications.show({
                    type: 'simulation',
                    message:
                        '<b>Arena unavailable.</b> ' +
                        'You can try waiting for it to start; head ' +
                            '<a class="link dim dark-green" ' +
                            'href="javascript: history.back()">back</a>; ' +
                        'or go to the ' +
                            '<a class="link dim dark-green" href="/">' +
                            'front page</a>',
                    css: 'black bg-yellow',
                });
                return;
            }

            console.log('[socket] new connection');
            states_init({fE, cl, st});
        }
    ); // socketman.js::onViewerConnection
});

socket.on("reset state", ({fE, cl, st}) => {
    console.log('[socket] new round');
    window.__Notifications.clear('simulation');
    states_init({fE, cl, st});
});

socket.on("robosync", () => {
    console.log("invalid robosync");
});

socket.on("update state", (payload) => {
    states_update(payload);

    // start music loop when possible, enabled
    if ([
        'started',
        'paused',
        'running'].includes(get_arena_status())) {
        if (!arenaAudio.isPlaying('battle loop')) {
            arenaAudio.play('battle loop');
        }
    }
});

socket.on('simulation start', () => {
    if (!is_realtime) return;

    arenaAudio.play('battle loop');
});

socket.on('battle start', () => {
    if (!is_realtime) return;

    arenaAudio.play('whistleshort');
});

socket.on('simulation end', () => {
    if (!is_realtime) return;

    arenaAudio.stop('battle loop');
    arenaAudio.play('battle end');
});

socket.on('robot launch', () => {
    if (!is_realtime) return;

    arenaAudio.play('robot launch');
});

socket.on('robot hit', () => {
    if (!is_realtime) return;

    arenaAudio.play('robot hit');
});

socket.on("robot wall", () => {
    if (!is_realtime) return;

    arenaAudio.play('robot wall');
});

socket.on("robot robot", () => {
    if (!is_realtime) return;

    arenaAudio.play('robot robot');
});

socket.on("robot knockout", ({id}) => {
    if (!is_realtime) return;

    arenaAudio.play('robot knockout');
    window.__Renderer.explode_robot(id);
});

socket.on("robot shock", ({id}) => {
    if (!is_realtime) return;

    arenaAudio.play('robot shock');
    window.__Renderer.shock_robot(id);
});

socket.on("simulation stop", () => {
    console.log("simulation stop");

    window.__Notifications.show({
        type: 'simulation',
        message:
            '<b>Simulation stopped.</b> ' +
            (window.location.href.includes("forceNew=1") ?
                '<a class="link dim dark-green" ' +
                    'href="javascript: location.reload();" ' +
                    'title="refresh">Refresh page</a> to restart' :
                '<a class="link dim dark-green" ' +
                    'href="/">Return to front page</a>'),
        css: 'black bg-light-blue',
    });
});

socket.on('balancerid.mismatch', (data) => {
    console.log("balancer mismatch detected", data);

    window.__Notifications.show({
        type: 'simulation',
        message:
            '<b>Load balancer mismatch.</b> ' +
            'Save any ' +
                '<a class="link dim dark-green" ' +
                'href="#top" title="go to top of page">' +
                'robots</a> ' +
            'and ' +
                '<a class="link dim dark-green" ' +
                'href="javascript: location.reload();" ' +
                'title="refresh">refresh page</a>',
        css: 'black bg-yellow',
    });
});

socket.on('disconnect', () => {
    set_sim_state('disconnected');
});

/* other client-side events */

document.querySelectorAll('.fit-arena').forEach(el => {
    el.addEventListener('click', () => {
        window.dispatchEvent(new Event('resize'));
    });
})

document.querySelectorAll("button[data-command]").forEach(el => {
    el.addEventListener("click", () => {
        socket.emit(el.dataset.command);
    });
})

/* expose to other libraries */

window.__Arena = {
    'Socket': socket,
    'states_init': states_init,
    'states_update': states_update,

    'Audio': arenaAudio, //XXX
};

}); // end window.load
})(); // end: ()
