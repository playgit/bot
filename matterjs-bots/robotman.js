const fs = require('fs');

const { resolve } = require("path");

const utils = require('./utils.js');

const pathext = resolve("./battle/brains/drivers-ext/");

console.log("[robotman]", pathext);

let SECRET = false;

const use_secret = (rawstr) => {
    SECRET = rawstr;
};

const calculate_robot_key = (id) => {
    let salted = '' + id + SECRET;
    return utils.sha256_hex(salted);
};

const save_robot = (robot) => {
    // sanitise
    robot.id = String(robot.id || '').trim();
    robot.key = String(robot.key || '').trim();
    robot.name = String(robot.name || '').trim();
    robot.team = String(robot.team || '').trim();
    robot.brain = String(robot.brain || '').trim();

    if (!robot) return [false, "Robot missing"];
    if (!robot.id) return [false, "Robot ID missing"];
    if (!robot.key) return [false, "Robot key missing"];
    if (!robot.name) return [false, "Robot name missing"];

    if (!((new RegExp('^[' + utils.allowed_patterns.name + ']+$'))
        .test(robot.name))) return [false, "Invalid Robot Name"];

    if (!robot.team) robot.team = robot.name;

    if (!((new RegExp('^[' + utils.allowed_patterns.name + ']+$'))
        .test(robot.team))) return [false, "Invalid Team Name"];

    robot.id = utils.sanitise_string(robot.id);

    // validate with salted sha256
    // console.log("DEBUG", utils.sha256_hex(robot.id + SECRET));
    if (robot.key != calculate_robot_key(robot.id))
        return [false, "Access Denied"];

    var fullpath = resolve(pathext + "/" + robot.id + ".json");
    // prevent path traversals
    if (!fullpath.startsWith(pathext + "/"))
        return [false, "Path traversal detected!"];

    // track save versions for compatibility with sim
    robot.version = 1;
    robot.updated = new Date();
    robot.oldBrains = [];

    let write_robot = true;

    // check if robot already exists
    prevrobot = load_robot(robot.id);
    if (prevrobot) {
        // diff previous and latest
        var clone1 = JSON.parse(JSON.stringify(prevrobot));
        delete clone1["oldBrains"];
        delete clone1["updated"];
        var clone2 = JSON.parse(JSON.stringify(robot));
        delete clone2["oldBrains"];
        delete clone2["updated"];

        if (JSON.stringify(clone1) == JSON.stringify(clone2)) {
            console.log("[robotman] identical", robot.id)
            write_robot = false;
        } else {
            let oldBrains = prevrobot.oldBrains || [];
            oldBrains.push([ prevrobot.updated, prevrobot.brain ]);
            oldBrains = oldBrains.slice(-5);
            robot = Object.assign({}, prevrobot, robot);
            robot.oldBrains = oldBrains;
            write_robot = "Robot updated";
        }
    } else {
        write_robot = "Robot created";
    }

    if (write_robot) {
        fs.writeFileSync(fullpath, JSON.stringify(robot));
        console.log("[robotman]", robot.id, "->", fullpath);
        return [true, write_robot];
    } else {
        return [true, "Robot unchanged"];
    }
}

const load_robot = (robotid, keys) => {
    robotid = String(robotid || '').trim();

    if (!robotid) return false;

    robotid = utils.sanitise_string(robotid);

    var fullpath = resolve(pathext + "/" + robotid + ".json");
    // prevent path traversals
    if (!fullpath.startsWith(pathext + "/")) return false;

    var robot = false;
    if (fs.existsSync(fullpath)) {
        robot = JSON.parse(fs.readFileSync(fullpath));

        // attach a convenience function to reload brain
        // sim can periodically refresh server-side brains
        // track the file change time to reduce disk i/o
        robot._ts_mtime = fs.statSync(fullpath).mtime.getTime();;
        robot.update = () => {
            let ts_mtime = fs.statSync(fullpath).mtime.getTime();
            if (ts_mtime != robot._ts_mtime) {
                robot.brain = JSON.parse(
                    fs.readFileSync(fullpath)).brain || '';

                console.log(
                    '[robotman] updated',
                    robot.id, robot.name,
                    robot._ts_mtime, '=>', ts_mtime);

                robot._ts_mtime = ts_mtime;
                return true;
            }
            return false;
        }
        robot.update();

        if (keys) {
            // (optional) only use certain keys
            let tmp = {};
            Object.keys(robot).forEach(k => {
                if (keys.includes(k)) {
                    tmp[k] = robot[k]
                }
            });
            robot = tmp;
        }
        console.log("[robotman] loaded", robotid, keys ? keys.join(' ') : 'ALL');
    }

    return robot;
}

const bulk_load = (listrobotids, keys) => {
    let robots = {},
        unique_ids = {};

    listrobotids.forEach(robotid => {
        let robot = load_robot(robotid, keys) || false,
            altid = false;

        if (!robot) {
            // look for dedup [x] tags
            // e.g. robotid[4] => robotid
            let dedup = robotid.match(/\[(\d+)\]$/);
            if (dedup) {
                suffix = dedup[1];
                altid = robotid.slice(0, -dedup[0].length)
                robot = load_robot(altid) || false;
                // give it the original robotid
                // dev: prevents last-resort deduplication
                robot.id = robotid;
                robot.name += ' ' + suffix;
            }
        }

        if (!robot) {
            console.log(
                '[robotman] bulk, could not load: ' + robotid);
            return;
        }

        // last-resort deduplication, follows simulation conventions
        // ensure the final list always have unique ids (and names)
        if (robot.id in unique_ids) {
            unique_ids[robot.id]++;
            let dedupcount = unique_ids[robot.id];
            robot.id += '[' + dedupcount + ']';
            robot.name += ' ' + dedupcount;
        }
        robots[robot.id] = robot;
        unique_ids[robot.id] = 1;

    });

    return robots;
}

const randomtoken = (idlen) => {
    if (!idlen) idlen = 8;

    let id = utils.secure_keystring(16),
        key = utils.sha256_hex(id + SECRET);

    return {
        "id": id,
        "key": key
    };
}

module.exports = {
    use_secret: use_secret,
    randomtoken: randomtoken,
    calculate_robot_key: calculate_robot_key,
    save: save_robot,
    load: load_robot,
    loadlist: bulk_load,
};
