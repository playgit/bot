var Lookups = (() => {
    let Internals = {};

    const get = (id, key) => {
        if (!Internals[id]) return "missing id";
        if (!Internals[id][key]) return "missing key";
        return Internals[id][key];
    };

    const register = (id, assoc) => {
        console.log('[Lookups] lookup init', id);
        Internals[id] = assoc;
    };

    return {
        register: register,
        get: get,
    };

})();
