const {VM, VMScript} = require('vm2');

const sync_execute = (() => {
    var cache = {}; // static
    return (script, withContext, options) => {
        var cname = script.constructor.name,
            options = Object.assign({
                timeout: 250,
                eval: false,
                wasm: false,
                fixAsync: false
            }, options || {});

        if (typeof cache == "undefined") cache = {};
        if (cname == "String") {
            if (!(script in cache)) {
                console.log("compile/cache supplied script");
                cache[script] = new VMScript(script);
            }
            script = cache[script];
        }

        options.sandbox = Object.assign({}, withContext || {});
        let resp = (new VM(options)).run(script);

        return resp;
    }
})();

module.exports = {
    // expose constructor only
    sync_execute: sync_execute
};
