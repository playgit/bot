/*

process manager

* multiprocess support (process.env.MULTINODE=1)
* maintains copy of global status sent by parent
* IPC handlers

*/

const sockman = require('./sockman.js');

let BALANCERID = String(process.env.BALANCERID || 'single'),
    MULTINODE = process.env.MULTINODE || false,
    GlobalState = false;

let Events = {};

const on = (() => {
    let counter = 0;
    return (event, func) => {
        Events[event] = (Events[event] || {});
        Events[event][counter] = func;
        counter++;
        console.log(
            '[' + BALANCERID + ':procman]',
            'registered event', event, counter);
        return counter;
    }
})();

const omni_status = (privileged) => {
    // expose single/multi-aware public status method
    // dev: useful for transparent API that works with both
    //  ensure both return similar data structs

    let ret = false;

    if (GlobalState) {
        ret = GlobalState
    } else {
        ret = sockman.instance_status()
    }

    if (privileged) {
        ret['elevated'] = true;
    } else {
        ret = sockman.scrub_status(ret);
        ret['elevated'] = false;
    }

    // attach the instance that provided this status
    ret['BALANCERID'] = BALANCERID;

    return ret;
}

const send_to_parent = (data) => {
    if (MULTINODE) {

        // attach data source
        if (typeof data == 'object' && !Array.isArray(data))
            data['BALANCERID'] = BALANCERID;

        process.send(data)
    }
}

const asyncDeregisterArena = async (arenaid) => {
    console.log(
        '[' + BALANCERID + ':procman]',
        'requesting close:', arenaid);

    // register a temporary event listener for the "deregistered" IPC
    let deregistered = false,
        listener_id = on('sockman.arenaDeregistered', (data) => {
            if (data.payload.arenaid == arenaid) deregistered = true;
        });

    // multiserver.js will redirect to the right process
    process.send({
        type: "sockman.deregisterArena",
        arenaid: arenaid
    });
    // wait for IPC to respond
    let ms = 0, ms_steps = 100, ms_max = 3000;
    while (ms < ms_max && !deregistered) {
        await new Promise(resolve => setTimeout(resolve, ms_steps));
        ms+=ms_steps;
    };
    // remove event listener
    delete Events['sockman.arenaDeregistered'][listener_id];

    return deregistered
}

const terminate_gracefully = () => {
    console.log(
        '[' + BALANCERID + ':procman]',
        'terminating gracefully');
    process.exit();
};

const terminate_balancer = (balancerid) => {
    send_to_parent({
        'type': 'procman.terminateBalancer',
        'payload': balancerid,
    });
    return true;
};

if (MULTINODE) {
    // forked from multiserver.js
    console.log(
        '[' + BALANCERID + ':procman]',
        'multiple instances');

    // setup IPC eventing on sockman

    sockman.on('arenaRegistered', function(data){
        send_to_parent(sockman.instance_status());
    });

    sockman.on('arenaDeregistered', function(data){
        send_to_parent(sockman.instance_status());
        send_to_parent({
            "type": "sockman.arenaDeregistered",
            "payload": {
                arenaid: data.arenaid
            }
        })
    });

    process.on('message', function(data) {
        if (data.type in Events) {
            Object.values(Events[data.type]).forEach(f => f(data))
        } else if (data.type == 'sockman.arenaDeregistered') {
            // parent::send_to_all() - reduce logging noise
        } else {
            console.log(
                '[' + BALANCERID + ':procman]',
                'unhandled IPC:', data);
        }
    });

    on('multiserver.status', (data) => {
        // store global state data for retrieval by this instance
        GlobalState = data;
        GlobalState["now"] = new Date();
        GlobalState["type"] = "sockman.status.all";
        // attach/overwrite BALANCERID for this instance
        GlobalState["BALANCERID"] = BALANCERID;
    });

    on('sockman.deregisterArena', (data) => {
        sockman.deregisterArena(data.arenaid);
    });

    on('procman.terminateBalancer', (data) => {
        if (data.payload == BALANCERID) {
            terminate_gracefully();
        }
    });

    setInterval(() => {
        // periodically send full status to parent
        send_to_parent(sockman.instance_status());
    }, 1000);

} else {
    console.log(
        '[' + BALANCERID + ':procman]',
        'single instance');
}

module.exports = {
    MULTINODE: MULTINODE,
    BALANCERID: BALANCERID,
    terminate_balancer: terminate_balancer,
    status: omni_status,
    send_to_parent: send_to_parent,
    asyncDeregisterArena: asyncDeregisterArena,
    on: on,
};
