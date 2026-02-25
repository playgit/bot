const fs = require('fs');

const { resolve } = require('path');

const utils = require('./utils.js');

const pathlogs = resolve("./static/simlogs/");

// json log object limit, csv log lines limit
// dev: does not affect: arbitrary json
const MAX_LOG_ITEMS = 1000;

const hashname = (simid) => {
    return simid;
};

const csv_write_row = (fullpath, headers, row) => {
    let len_headers = headers.length,
        is_datalist = Array.isArray(row),
        len_row = (is_datalist ? row.length
            : Object.keys(row).length);

    if (len_row < len_headers)
        throw Error('not enough row data for headers');

    // dev: headers determine order of columns

    let lines = [],
        row_headers = '"' + headers.join('","') + '"';

    if (fs.existsSync(fullpath)) {
        // read entire file
        lines = fs.readFileSync(fullpath, 'utf8').trim().split('\n');
        if (lines.shift() == row_headers) {
            console.log('[logman] same csv headers:', fullpath);
        } else {
            console.log('[logman] different csv headers:', fullpath);
            lines = []; // clear existing lines
        }
    }

    // generate the new csv line
    let line = false;
    if (is_datalist) {
        line = row;
    } else {
        // order of data written is based on header order
        headers.forEach(header => line.push(row[header] || ''));
    }
    lines.push(line.join(","));

    lines = lines.slice(-MAX_LOG_ITEMS); // regulate number of lines
    lines.unshift(row_headers); // re-add headers

    fs.writeFileSync(fullpath, lines.join('\n'));

    console.log(
        '[logman] robot results, csv:', fullpath,
        'size:', lines.length);
};

const store_robot_results_csv = (arenaid, Placements, Robots) => {
    let robotnames = []
    Robots.forEach(robot => robotnames.push(robot.entityName));
    robotnames.sort();

    let headers = [
        "Date-Time",
    ];

    let columns = [
        "Placement",
        "Lifetime",
        "Distance",
        "Health",
        "Accuracy",
    ];

    // acquire full set of headers for structure checking
    robotnames.forEach(robotname => {
        columns.forEach(colname =>
            headers.push(robotname + " " + colname));
    });

    // get metadata and placement by robot name
    let by_robotname = {},
        rname = false,
        rlifetime = false,
        rdistance = false,
        rhealth = false,
        raccuracy = false;
    Placements.map((P, placing) => {
        P.participants.map(part => {
            // COMPAT: results structures
            if (part.entityName) {
                // dev: v2 format
                rname       = part.entityName;
                rlifetime   = part.lifespan;
                rdistance   = part.dcenter;
                rhealth     = part.health;
                raccuracy   = part.accuracy;
            } else if (Array.isArray(part)) {
                // dev: v1 format: order-sensitive array
                rname       = part[0];
                rlifetime   = part[3];
                rhealth     = part[6];
                raccuracy   = part[7];
                rdistance   = -1;
            } else {
                throw new TypeError('unknown results structure');
            }
            // END COMPAT: results structures
            by_robotname[rname] = {
                Placement   : placing + 1,
                Lifetime    : rlifetime.toFixed(2),
                Distance    : rdistance.toFixed(1),
                Health      : rhealth,
                Accuracy    : raccuracy.toFixed(2),
            }
        })
    });

    // generate flat results
    let row = [],
        now = new Date(),
        dt = utils.dateToLocalText(now);

    row.push(dt);
    robotnames.forEach(robotname => {
        let metadata = by_robotname[robotname];
        columns.forEach(colname => row.push(metadata[colname]))
    });

    // create/append to csv
    let fullpath = resolve(pathlogs + "/" + hashname(arenaid) + ".csv");
    csv_write_row(fullpath, headers, row);
}

const store_arbitrary_json = (filename, payload) => {
    var fullpath = resolve(pathlogs + "/" + filename + ".json");
    fs.writeFileSync(fullpath, JSON.stringify(payload));
    console.log('[logman] arbitrary json:', fullpath);
}

const store_robot_results_json = (arenaid, Placements) => {
    var fullpath = resolve(pathlogs + "/" + hashname(arenaid) + ".json");

    let logs = [];
    if (fs.existsSync(fullpath)) {
        if (!Placements) {
            // file already exists, don't waste I/O parsing
            return;
        }
        logs = JSON.parse(fs.readFileSync(fullpath));
    }
    if (!Array.isArray(logs)) logs = []; // ensure always a list

    if (Placements) {
        // allow blank logs to be created;
        logs.push({
            'datetime': new Date(),
            'placements': Placements
        });
    }

    logs = logs.slice(-MAX_LOG_ITEMS);

    fs.writeFileSync(fullpath, JSON.stringify(logs, null, 2));

    console.log(
        '[logman] robot results, json:', fullpath,
        'size:', logs.length);
}

const json_file_list = (globlike) => {
    const files =
        fs.readdirSync(pathlogs, {withFileTypes: true})
            .filter(item => !item.isDirectory())
            .map(item => item.name);

    if (!globlike) filter = '*';
    if (!globlike.toLowerCase().endsWith('.json')) globlike += '.json';

    globlike = new RegExp(
        '^' +
        (globlike
            .replaceAll('.', '\\.')
            .replaceAll('*', '.*')
            .replaceAll('?', '.{1}')) +
        '$', 'mu');

    let paths = [];
    files.forEach(file => {
        if (globlike.test(file)) {
            paths.push(resolve(pathlogs + '/' + file));
        }
    });

    return paths;
};

const json_file_remove = (fullpath) => {
    if (!fullpath.toLowerCase().endsWith('.json'))
        throw new Error('[logman] remove json, not json:', fullpath);

    if (!fullpath.startsWith(pathlogs + '/'))
        throw new Error('[logman] remove json, traversal:', fullpath);

    if (!fs.existsSync(fullpath))
        throw new Error('[logman] remove json, not found:', fullpath);

    fs.unlinkSync(fullpath);

    console.log('[logman] remove json:', fullpath);
}

const read_robot_results_json = (arenaid) => {
    var fullpath = resolve(pathlogs + "/" + hashname(arenaid) + ".json");

    let logs = false;
    if (fs.existsSync(fullpath)) {
        logs = JSON.parse(fs.readFileSync(fullpath));
    }

    return logs;
}

const check_robot_results_csv = (arenaid) => {
    var fullpath = resolve(pathlogs + "/" + hashname(arenaid) + ".csv");

    if (fs.existsSync(fullpath)) return fullpath;

    return false;
}

module.exports = {
    csv : {
        store_robot_results: store_robot_results_csv,
        check_robot_results: check_robot_results_csv,
    },
    json : {
        list: json_file_list,
        remove: json_file_remove,
        store: store_arbitrary_json,
        store_robot_results: store_robot_results_json,
        read_robot_results: read_robot_results_json,
    }
};
