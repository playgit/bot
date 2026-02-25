/* basic load-balancing support for websockets

websocket: ensure same backend is served using nginx map
and query param balancerid=<deterministic id>
*/

const crypto = require('crypto');

const simulation_utils = require('./battle/utils.js');

const ext_friendlytime = require('./static/util.friendlyTimes.js');

let PROCS = 0;

const use_balancer = (num) => {
    PROCS = parseInt(num) || 1;
    console.log("[utils] instances =", PROCS);
};

const balancerid = (id) => {
    // sanity check
    if (PROCS <= 0) {
        console.log('[WARNING] invalid PROCS', PROCS)
        PROCS = 1;
    }
    // generate deterministic balancerid [1, PROCS] from arenaid
    let bid = (Array.from(id).reduce((
        prev, curr) => prev + curr.charCodeAt(0), 0) % PROCS) + 1;

    // dev: return string for consistency in list and dicts
    return String(bid);
};

/* utility functions */

let allowed_patterns = {
    'default'   :
        'A-Za-z0-9_'
        + '\\-',
    'name'      :
        'A-Za-z0-9_ ,.:+=()*&%$#@!'
        + '\\-'
        + '\''
        + '\"'
        + '\\\\'
        + '\\\/',
};

const sanitise_string = (str, key) => {
    str = String(str || '').trim();

    let pat = '';
    if (key) {
        pat = allowed_patterns[key];
    } else {
        pat = allowed_patterns.default;
    }

    pat = test = new RegExp('[^' + pat + ']', "gm");
    return str.replaceAll(pat, "_");
};

/* crypto */

const secure_keystring = (len) => {
    var chars = "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890";
    return Array.from(
        { length: len },
        () => chars[crypto.randomInt(0, chars.length)]).join("");
};

const sha256_hex = (str) => {
    // longer, more limited charactesr in use
    return crypto.createHash('sha256').update(str).digest('hex');
}

const sha256_base64 = (str) => {
    // shorter, more special symbols
    return crypto.createHash('sha256').update(str).digest('base64');
}

const num2letters = (num) => {
    num = parseInt(num);
    let str = '';
    while (num>25) {
        str += 'Z';
        num=num-26
    }
    str += String.fromCharCode(65 + num)
    return str;
}

module.exports = {
    allowed_patterns: allowed_patterns,
    use_balancer: use_balancer,
    balancerid: balancerid,
    sha256_hex: sha256_hex,
    sha256_base64: sha256_base64,
    secure_keystring: secure_keystring,
    sanitise_string: sanitise_string,
    num2letters: num2letters,
    shuffleArray: simulation_utils.shuffleArray,
    dateToLocalText: ext_friendlytime.toLocalText,
};
