(() => {

const expectType = (arr, key, expected_types) => {
    if (key in arr) {
        if (!expected_types.includes(typeof arr[key])) {
            throw TypeError(
                key + " should be " + expected_types.join(", "));
        }
    }
}

const compile = (code) => {
    // safer eval/compile function for untrusted brain code, based on:
    // * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#Never_use_eval!
    // * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/Function

    // ensure code is a string
    if (!code) code = "";

    var brainStatus = "unknown",
        func = false;

    try{
        // generate test function [start]
        func = new Function('context', '"use strict";' + code);
        // dev: define persistent fake state subkeys
        var fakecontext = {
            "action": {},
            "memory": {},
            "state": {
                "name": "Debug 1",
                "team": "Team Debug 1",
                "scanner": {
                    "wall": [],
                    "robot": [],
                    "projectile": [],
                    "ALL": [],
                },
                "proximity": [],
                "position": {
                    "x": 100,
                    "y": 200
                },
                "angle": 2.1400183660255045,
                "angleToCenter": 4.71238898038469,
                "maxForce": 0.001,
                "maxRotate": 0.272
            }
        };
        // test function with fake context
        func(fakecontext);
        // rudimentary action validation
        expectType(fakecontext["action"], "desiredAngle", ["number"]);
        expectType(fakecontext["action"], "desiredForce", ["number"]);
        expectType(fakecontext["action"], "desiredLaunch", ["boolean"]);
        expectType(fakecontext["action"], "desiredScan", ["number"]);
        // generate test function [end]
        var lines = (code || '').trim().split("\n").length;
        brainStatus = [func, "compiled " + lines + " line" + (lines == 1 ? "" : "s")];
    } catch (e) {
        brainStatus = [false, e.name + ", " + e.message];
    }

    return brainStatus;
}

window.doBrainCompile = compile;

})(); // end: ()