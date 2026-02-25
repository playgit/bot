const path = require('path');

// base http server

const express = require("express");
const app = express();
const http = require("http").createServer(app);

app.set('views', path.join(__dirname, 'views'));

// cookie support

const cookieParser = require('cookie-parser')
app.use(cookieParser())

// jinja templating

const expressNunjucks = require('express-nunjucks');

expressNunjucks(app, {watch: true, noCache: true});

/* general utilities */

const utils = require('./utils.js');

/* external config */

const dotenv = require('dotenv');

dotenv.config();

let APIKEY = String(process.env.APIKEY || '').trim();
if (!APIKEY) {
    APIKEY = utils.secure_keystring(32);
    console.log(
        "[WARNING][.env] missing APIKEY, using ", APIKEY);
}

/* http and socket port */

let PORT = parseInt(process.env.PORT || 5001);

http.listen(PORT, () => console.log("listening at", PORT));

/* load balancer */

utils.use_balancer(process.env.PROCS);

/* socket management */

const { Server } = require("socket.io");
const io = new Server(http);

const sockman = require("./sockman.js");

sockman.init(io);

/* process management */

const procman = require("./procman.js");

/* competition management */

const compman = require("./compman.js");

/* robot management */

const robotman = require("./robotman.js");

robotman.use_secret(process.env.SECRET);

/* simulator */

const simulation = require("./battle/simulation.js");

simulation.inject_debug(process.env.SIMULATOR_INJECT_DEBUG_INTO_ROBOT);
simulation.set_fastmode(process.env.SIMULATOR_FAST_RESOLUTION);

/* simulation logs */

const logman = require("./logman.js");

/* expressjs */

app.use(express.static("static"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// routes: robot

app.get('/robot/samples', (req, res) => {
    res.render('robot.samples.html', {
        'config': {
            'cdn': 'localcdn',
        },
    });
});

app.get('/robot/docs', (req, res) => {
    res.render('robot.docs.html', {
        'config': {
            'cdn': 'localcdn',
        },
    });
});

app.all('/robot/checklist', (req, res) => {
    let robotids = String(
            req.body.robotids ||
            req.params.robotids ||
            '').trim();

    robotids = robotids.replaceAll('\n', ',').replaceAll('\r', ',').split(/(?:,| )+/);

    let unique = {},
        response = {
            OK: [],
            missing: [],
            duplicate: [],
        };

    console.log(robotids);

    robotids.forEach(robotid => {
        if (robotid in unique) {
            response.duplicate.push(robotid);
        }
        unique[robotid] = robotid;
        if (robotman.load(robotid)) {
            response.OK.push(robotid);
        }  else {
            response.missing.push(robotid);
        }
    });

    res.json({
        "now": new Date(),
        "response": response,
    });
});


app.all('/robot/fetch', (req, res) => {
    let robotid = String(
            req.body.robotid ||
            req.params.robotid ||
            '').trim();

    let robot = robotman.load(robotid);

    // never expose key in insecure way
    if (robot.key) delete robot["key"];

    if (req.query.ret == 'json') {
        res.json(robot);
    } else {
        res.send(robot.id || 'none');
    }
});

app.all('/robot/update', (req, res) => {
    if (req.method == "POST") {
        let results = robotman.save(req.body.robot)

        if (req.query.ret == 'json') {
            // return as json
            res.json({
                "now": new Date(),
                "action": results,
            });

        } else {
            // return as html
            if (results[0]) {
                msg = ["notify-success", results[1]];
            } else {
                msg = ["notify-fail", results[1]];
            }

            // really simple message "flashing" (set)
            res.cookie(
                'msgResults', msg,
                { maxAge: 60000, httpOnly: true });

            // prevent resubmission prompt on refresh
            res.redirect(req.path);
        }

        return;
    }

    // really simple message "flashing" (get)
    let msgResults = req.cookies.msgResults;
    res.clearCookie('msgResults');

    res.render("robot.html", {
        'msgResults': msgResults,
        'config': {
            'cdn': 'localcdn',
            'regex_name': utils.allowed_patterns.name,
        },
    });
});

// route: arena

app.all("/arena/:arenaid", (req, res) => {
    let arenaid = utils.sanitise_string(req.params.arenaid); // slugified

    // dev: sticky load-balancing for websockets (ws)
    //  nginx, ws has limited "sticky sessions" feature
    //  inject a balancerid key during client socketio init
    //  nginx map reroutes balancerid to upstream
    let balancerid = utils.balancerid(arenaid);

    // generate a robot id and robot key based on the arenaid
    let robotid = 'bot' + arenaid;

    arenapost = false;
    if (req.method == 'POST') {
        arenapost = {
            forceNew: req.body.forceNew || 0,
            manualBrains: req.body.manualBrains,
        };
    }

    // allow local js scripts, available only via expressjs
    let injectlocal = "" + (req.query.injectlocal || ""),
        _injectlocal = [];
    if (injectlocal) {
        if (injectlocal.includes(",")) {
            injectlocal = injectlocal.split(",");
        } else {
            injectlocal = [injectlocal];
        }
    } else {
        injectlocal = [];
    }
    injectlocal.forEach(p => {
        p = p.trim();
        if (!p) return;
        // prevent path disclosure by adding slash
        if (!p.startsWith("/")) p = "/" + p;
        if (!p.endsWith(".js")) return;
        p = path.resolve(p);
        _injectlocal.push(p);
    });
    injectlocal = _injectlocal;

    // support different renderers
    let renderers = ["default", "babylonjs"],
        default_renderer = renderers[0],
        renderer = req.query.renderer || default_renderer;
    if (!renderers.includes(renderer)) renderer = default_renderer;

    res.render("arena.html", {
        'balancerid': balancerid,
        'arenaid': arenaid,
        'arenaonly': !!req.query.arenaonly,
        'renderer': renderer,
        'arenapost': arenapost,
        'robotid': robotid,
        'robotkey': robotman.calculate_robot_key(robotid),
        'injectlocal': injectlocal,
        'config': {
            'cdn': 'localcdn',
        },
    });
});

app.get("/check/data/:arenaid", (req, res) => {
    let arenaid = req.params.arenaid;

    let response = {
        'available': false,
        'response': {
            'results': logman.csv.check_robot_results(arenaid),
            'recordings': logman.json.list(
                '_recording.' + arenaid + '.*.json')
                    .map(fullpath => fullpath.split('/').pop())
                    .sort(),
        }
    };

    res.json(response);
});

// route: main/front page

app.get("/", (req, res) => {
    res.render("index.html", {
        'config': {
            'cdn': 'localcdn',
            'regex_arenaid': utils.allowed_patterns.default
        },
    });
});

app.get("/3dmodelviewer/", (req, res) => {
    res.render("viewer.3d.html", {
        'config': {
            'cdn': 'localcdn',
        },
    });
});

// routes: api

app.get("/api", async (req, res) => {
    res.render("api.html", {
        'config': {
            'cdn': 'localcdn',
        },
        'apikey': req.query.api || '',
    });
});

app.all(["/api/status"], (req, res) => {
    res.json(procman.status(
        (req.body.api || req.query.api) == APIKEY));
});

app.all("/api/close/:arenaid", async (req, res) => {
    if ((req.body.api || req.query.api) != APIKEY) {
        res.status(403);
        res.send();
        return;
    }

    let arenaid = req.params.arenaid,
        response = {
            "now": new Date(),
            "action": false,
        };

    if (procman.MULTINODE) {
        response["action"] = await procman.asyncDeregisterArena(arenaid);
    } else {
        response["action"] = sockman.deregisterArena(arenaid);
    }

    res.json(response);
});

app.all("/api/kill/:balancerid", async (req, res) => {
    if ((req.body.api || req.query.api) != APIKEY) {
        res.status(403);
        res.send();
        return;
    }

    let balancerid = req.params.balancerid;

    let response = {
            "now": new Date(),
            "action": procman.terminate_balancer(balancerid),
        };

    res.json(response);
});

app.all("/api/robot/generate", async (req, res) => {
    if ((req.body.api || req.query.api) != APIKEY) {
        res.status(403);
        res.send();
        return;
    }

    res.json({
        "now": new Date(),
        "response": robotman.randomtoken(),
    });
});

app.get(["/api/noop", "/api/noop", "/api/noop/:reflect"], (req, res) => {
    // noop: useful for testing multiprocess deploys

    console.log("noop requested")

    res.json({
        "now": new Date(),
        "response": req.params.reflect || false
    });
});

app.get('/competition/:compid', (req, res) => {
    res.render('competition.html', {
        config: {
            cdn: 'localcdn',
        },
        compid: req.params.compid || false,
    });
})

app.all('/api/competition/:compid', (req, res) => {
    res.json(compman.status(req.params.compid || false));
});

app.all('/api/competition/start/:compid', (req, res) => {
    if ((req.body.api || req.query.api) != APIKEY) {
        res.status(403);
        res.send();
        return;
    }

    let action = false;
    try {
        action = compman.competitionVersus(
            req.params.compid,
            req.body.robotList,
            {
                groupMax: req.body.groupMax
            }, {
                sim: {
                    locked: true,
                    maxRounds: req.body.maxRounds,
                    autorestart: req.body.autorestart,
                },
                rules: {
                    limit: {
                        round: req.body.limitRound,
                    }
                }
            }
        );
    } catch(e) {
        action = e.message;
    }

    res.json({
        "now": new Date(),
        "action": action,
    });
});
