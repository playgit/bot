const Factory = () => {
    let Loops = {},
        HALT = false;

    const start = async (id, func, ideal, debug) => {
        if (HALT) return;

        let started = (new Date()).getTime();
        await func();
        let elapsed = (new Date()).getTime() - started;

        let next = Math.min(Math.max(ideal - elapsed, 0), ideal);

        if (debug) {
            console.log(
                "[loop]", id,
                elapsed.toFixed(3), next.toFixed(3));
        }

        Loops[id] = setTimeout(() => {
            start(id, func, ideal, debug);
        }, next);
    }

    const stop = id => {
        if (Loops[id]) {
            clearTimeout(Loops[id]);
            Loops[id] = false;
            console.log("[loop] cleared:", id);
        } else {
            console.log("[loop] " + id + " not found");
        }
    }

    const halt = () => {
        // dev: failsafe for fast loops that don't clear themselves
        //  use only during disposal of a loop
        //  XXX: not used
        HALT = true;
        console.log("[loop] HALT");
    }

    return {
        start: start,
        stop: stop,
        halt: halt
    };

}; // Factory()

module.exports = {
    Factory: Factory
}
