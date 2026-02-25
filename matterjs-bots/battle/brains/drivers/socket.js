const hard_pause = (ms, debugid) => {
    return new Promise(resolve => {
        if (debugid) console.log(debugid, "hard pause start");
        setTimeout(() => {
            if (debugid) console.log(debugid, "hard pause end");
            resolve();
        }, ms)
    });
}

const Factory = (activeSocket) => {
    const executor = async(context) => {
        // remote expected to return modified context:
        //  {action[, memory][, debug]}

        let socket = activeSocket(context.state);

        // pre-execute Function in first-level of debug
        // dev: used for server-side PRNG
        Object.keys(context.debug).forEach(k => {
            if (context.debug[k].constructor.name == "Function") {
                context.debug[k] = context.debug[k]();
            }
        });

        modified = await new Promise((resolve, reject) => {
            let timeout = setTimeout(()=>{
                reject({message: "timeout"});
            }, 500);

            socket.emit("cogitate", context, (ctx) => {
                clearTimeout(timeout);
                resolve(ctx)
            });
        });

        return modified;
    }

    const precheck = async(context) => {
        activeSocket(context.state);
    };

    return {
        "precheck": precheck,
        "executor": executor
    };
};

module.exports = Factory;
