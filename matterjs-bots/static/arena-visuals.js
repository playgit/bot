function createArenaVisuals(context, fontfamily, fontsize) {
// factory to ensure local scoping of persistent variables

if (!tagsafe) throw Error('util.tagsafe.js not loaded');

let State = {
    "spritesLoaded": false,
    "explodingRobots": [],
    "shockedRobots": [],
};

let EntitySprites = false;

if (typeof Animator == "function") {
    EntitySprites = Animator({
        "explosion_continuous":
            ["/artwork/explosion.512x512.16.png",
                // (debug) play continuously - right to left
                Animator.Factory.spriteCurrentFrame (
                    128, 128, 12, (f, fc) => {
                    if (!f) f = fc;
                    f--;
                    return f;
                })
            ],
        "explosion_oneoff": {
            "src": "/artwork/explosion.512x512.16.png",
            "before": [
                // play once only - left to right
                Animator.Factory.spriteCurrentFrame(
                    128, 128, 1, (f, fc, meta) => {
                    if (typeof f == "undefined") f = -1;
                    f++;
                    return f;
                })
            ],
            "after": [
                // cleanup robots after completely exploded
                function(src, tgt, meta){
                    if (meta.norender
                            && meta.srcid
                            && State.explodingRobots.includes(meta.srcid)){
                        State.explodingRobots.splice(
                            State.explodingRobots.indexOf(meta.srcid), 1);
                    }
                }
            ]
        },
        "shock_oneoff": {
            "src": "/artwork/shock.256x256.4.png",
            "before": [
                // play once only - left to right
                Animator.Factory.spriteCurrentFrame(
                    128, 128, 1, (f, fc, meta) => {
                    if (typeof f == "undefined") f = -1;
                    f++;
                    return f;
                })
            ],
            "after": [
                // cleanup robots after completely exploded
                function(src, tgt, meta){
                    if (meta.norender
                            && meta.srcid
                            && State.shockedRobots.includes(meta.srcid)){
                        State.shockedRobots.splice(
                            State.shockedRobots.indexOf(meta.srcid), 1);
                    }
                }
            ]
        },
        "robot":
            ["/artwork/robot.48x30.2.png",
                // switch frames based on state of robot
                Animator.Factory.spriteCurrentFrame(
                    24, 30, 1,
                    (f, fc, ctick, meta) => meta.active ? 0:1
                )
            ],
        "floor": "/artwork/plate.64x64.png"
    }, (num) => {
        State.spritesLoaded = true;
    });
} else {
    console.log("[arena-visuals] Animator not found, sprites not loaded");
}; // if (typeof Animator == "function")

return ((context, fontfamily, fontsize) => {
    fontfamily = fontfamily || "sans-serif";
    fontsize = fontsize || 12;

    let ctx = context,
        ctxStandardFont = fontsize + "px " + fontfamily,
        currentFrame = false,
        robotById = false,
        robot_count = 0,
        font_datauris = [],
        fonts_loaded = false;

    (async function() {
        // retrieve custom fonts from document css styles
        var fonts = [];
        for (const ss of document.styleSheets) {
            try {
                // external style sheet rules cannot be accessed
                // https://stackoverflow.com/a/49160760
                var rules = ss.cssRules;
            } catch(e) {
                console.log(
                    "[arena-visuals]",
                    "cannot read rules from", ss.href);
                continue;
            }
            for (const rule of rules) {
                if (rule.cssText.startsWith("@font-face")) {
                    var fontFamily = rule.style
                            .getPropertyValue('font-family'),
                        url = rule.style
                            .getPropertyValue('src')
                            .match(/url\(\"(.*?)\"\)/);
                    if (url) fonts.push([fontFamily, url[1]]);
                }
            };
        };
        // preload custom fonts, store as datas uri
        for (const font of fonts) {
            let blob = await fetch(font[1]).then(r => r.blob());
            let datauri = await new Promise(resolve => {
                let reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            console.log(
                "[arena-visuals]",
                "font preloaded:", font[0], datauri.length);
            font_datauris.push([font[0], datauri]);
        }
        fonts_loaded = true; // completed
    })();

    const sprite_robot_body = (id) => {
        var body = robotById[id];
        EntitySprites.to_canvas(
            ctx, "robot",
            body.ce[0], body.ce[1],
            body.eW, body.eH, body.an,
            { tick: currentFrame,
              id: "r." + body.id,
              // [ac]tive
              active: body.ac }
        );
    };

    const sprite_robot_explosion = (id) => {
        var body = robotById[id];
        EntitySprites.to_canvas(
            ctx, "explosion_oneoff",
            body.ce[0], body.ce[1],
            body.mD * 3, body.mD * 3, body.an,
            { tick: currentFrame,
              id: "r.e." + id,
              srcid: id }
        );
    };

    const sprite_robot_shock = (id) => {
        var body = robotById[id];
        EntitySprites.to_canvas(
            ctx, "shock_oneoff",
            body.ce[0], body.ce[1],
            body.mD * 2, body.mD * 2, body.an,
            { tick: currentFrame,
              id: "r.s." + id,
              srcid: id }
        );
    };

    var layers = {};

    var styles_shared = '' +
        '<style>' +
            'table#ranks { ' +
                'padding-bottom:1.0em;' + // dev: prevent firefox clipping
                'font-size:12px;' +
                'border-spacing: 2px 1px;' +
                'font-family: sans-serif; }' +
            'table#ranks tr { ' +
                'color: rgba(255,255,255,0.6); ' +
                'background: rgba(100,100,100,0.6); }' +
            //'table#ranks tr:nth-child(2n+1) { ' +
            //    'background: rgba(100,100,100,0.6); }' +
            'table#ranks tr.pos-1 > td { ' +
                'color: black; ' +
                'background: linear-gradient(to bottom right, #f8b500, #fceabb); }' +
            'table#ranks tr.pos-2 > td { ' +
                'color: black; ' +
                'background: linear-gradient(to bottom right, #757f9a, #d7dde8); }' +
            'table#ranks tr.pos-3 > td { ' +
                'color: white; ' +
                'background: linear-gradient(to bottom right, #603813, #b29f94); }' +
            'table#ranks td, table#ranks th { ' +
                'vertical-align: middle; ' +
                'text-align: center; ' +
                'padding: 2px; }' +
            'table#ranks th { ' +
                'color: white; ' +
                'padding: 5px; ' +
                'background: rgba(0,51,102,0.7); }' +
            'table#ranks .pos { ' +
                'font-size: 15px; ' +
                'font-weight: bold; }' +
            'table#ranks td div { ' +
                'margin-bottom: 2px; ' +
                'display: flex; ' +
                // 'border: 1px solid red; ' +
                'justify-content: space-between; }' +
            'table#ranks td div:last-child { ' +
                'margin-bottom: 0; }' +
            'table#ranks .b { ' +
                'font-size: 9px; ' +
                'padding: 2px 4px 1px 4px; ' +
                'border-radius: 3px 3px; ' +
                'color: white; ' +
                'background: purple; }' +
        '</style>' ;

    const layer_html = (layerid, html, options) => {
        // render fixed-width variable-height html
        // supports (ratecapped) content update, custom fonts

        if (!fonts_loaded) return false;

        let NOW = (new Date).getTime() / 1000,
            height = false,
            cw = ctx.canvas.width,
            ch = ctx.canvas.height,
            LTRB = false;

        options = Object.assign({
            width: 300,
            xmult: 0.5, // horizontally-centred
            ymult: 0.5, // vertically-centred
            ratecap: 0.1,
        }, options);

        var layer = false;
        if (!(layerid in layers)) {
            layer = {
                "loading": false,
                "updated": NOW,
                "html": false,
                "final": false,
                "image": new Image()
            };
            layers[layerid] = layer;
        } else {
            layer = layers[layerid];
        }

        // refresh when content has changed with a recap
        // dev: debounces rapid html change

        let html_changed = (html != layer.html),
            exceeded_ratecap = (NOW - layer.updated >= options.ratecap),
            not_loading = !layer.loading;

        if (html_changed && exceeded_ratecap && not_loading) {
            // generate hidden html element to estimate height
            let divcalc = document.createElement("div"),
                container = document.createElement("div");
            divcalc.style.height = "0px";
            divcalc.style.width = "0px";
            divcalc.style.overflow = "hidden";
            divcalc.append(container);

            // container behaves as a pseudo-page
            // height expands to html
            container.style.width = options.width + "px";
            container.innerHTML = html;
            document.body.appendChild(divcalc);
            height = Math.ceil(container.offsetHeight);

            // cleanup
            document.body.removeChild(divcalc);

            let fontfaces = font_datauris.map(x =>
                    "@font-face { "
                        + "font-family: " + x[0] + "; "
                        + "src: url('" + x[1] + "');  }").join(" "),
                data =
                    '<svg xmlns="http://www.w3.org/2000/svg" ' +
                    'width="' + options.width + '" ' +
                    'height="' + height + '">' +
                        '<foreignObject width="100%" height="100%">' +
                            '<div xmlns="http://www.w3.org/1999/xhtml">' +
                            '<style>' + fontfaces + '</style>' +
                            html +
                            '</div>' +
                        '</foreignObject>' +
                    '</svg>',
                imgsrc = "data:image/svg+xml;base64," + window.btoa(data);

            layer.image.onload = function(){
                if (!layer.final) layer.final = document.createElement('canvas');

                // double-buffer write to prevent flickering
                layer.final.width = layer.image.width;
                layer.final.height = layer.image.height;
                layer.final.getContext("2d").drawImage(layer.image, 0, 0);

                console.log(
                    "[arena-visuals]",
                    "layer_html:", layerid, options,
                    (new Date).getTime() / 1000 - layer.loading);

                layer.loading = false;
                layer.updated = NOW;
            };
            layer.loading = NOW;
            layer.html = html;
            layer.image.src = imgsrc; // trigger load/reload
        }

        if (layer.final) {
            // [l, t, r, b]
            LTRB = [
                (cw - layer.final.width) * options.xmult,
                (ch - layer.final.height) * options.ymult,
            ];
            LTRB.push(LTRB[0] + layer.final.width);
            LTRB.push(LTRB[1] + layer.final.height);

            ctx.drawImage(
                layer.final,
                (cw - layer.final.width) * options.xmult,
                (ch - layer.final.height) * options.ymult);

            // check whether tainted
            // console.log("[arena-visuals] dataURL", ctx.canvas.toDataURL());
        }

        return LTRB;
    };

    const html_wrap = (tag, obj) => {
        // wraps obj in specified tag with attributes
        // obj can be primitive or object {value: ..., [attributes]}
        // returns list [<start tag>, content, <end tag>]
        var attrs = [],
            html = obj;
        if (typeof(obj) === "object" && !Array.isArray(obj)) {
            for (span of ["rowspan", "colspan"]) {
                if (span in obj) {
                    var val = obj[span];
                    if (val === false) continue
                    else if (val > 0) attrs.push(span + '="' + val + '"')
                    else if (val <= 0) return false;
                }
            };
            for (attr of ["class", "style"]) {
                if (attr in obj)
                    attrs.push(attr + '="' + obj[attr] + '"');
            }
            html = obj.value;
        }
        attrs = attrs.join(" ");
        if (attrs) attrs = " " + attrs;
        return ["<" + tag + attrs + ">", html, "</" + tag + ">"];
    };

    const html_row_cells = (rows, options) => {
        // return html table rows and cells with attributes
        // expects rows to be list (rows) of lists (cols)
        // column value can be primitive or object (re: html_wrap)
        options = Object.assign({
            tag: "td",
            cell: (rowidx, colidx, val) =>
                (Array.isArray(val) ?
                    "[" + rowidx + ", "  + colidx + ", " + val[0] + "] " +
                        "(" + val.length + ")"
                    : val)
        }, options);

        if (Array.isArray(rows) && rows.every(i => (typeof i === "string")))
            rows = [rows];

        var html = [];
        for (var rowidx=0; rowidx < rows.length; rowidx++){
            var rowdef = html_wrap("tr", rows[rowidx]);
                cols = rowdef[1],
                row = [];
            for (var colidx=0; colidx < cols.length; colidx++){
                tokens = html_wrap(options.tag, cols[colidx]);
                if (tokens === false) continue; // don't render
                tokens[1] = options.cell(rowidx, colidx, tokens[1]);
                row.push(tokens.join(""));
            }
            rowdef[1] = row.join("");
            html.push(rowdef.join(""));
        }

        return html.join("");
    };

    let results_cache = {};

    const process_results = (results) => {
        // server already "placed" (1,2...) robots/teams
        // generation only runs once per new results (i.e. per round)

        if (!results_cache.robots) {
            var teamcounts = [];
            results_cache.robots = results.robots.reduce((acc, x, idx)=>{
                x.participants.forEach((r, ridx) => {
                    let rowspan = false;
                    if (x.participants.length > 1) {
                        if (ridx > 0) rowspan = -x.participants.length;
                            else rowspan = x.participants.length;
                    }
                    teamcounts[r.entityTeam] = (
                        teamcounts[r.entityTeam] || 0) + 1;
                    var pos = idx + 1;
                    // dev: prevent html injection
                    acc.push({
                        class: "pos-" + pos,
                        value: [
                            {
                                value: pos,
                                class: "pos",
                                rowspan: rowspan
                            },
                            tagsafe(r.entityName),
                            r.lifespan.toFixed(4),
                            r.dcenter.toFixed(0),
                            r.health,
                            r.accuracy.toFixed(2) +
                                '% (' + r.hits + '/' + r.misses + ')',
                        ]}
                    );
                });
                return acc;
            }, []);

            // generate additional metadata and express them via flags
            // these are useful to determine what to render later

            for (const [team, count] of Object.entries(teamcounts)) {
                // MultiRobotTeams = more than 1 robot per teams
                if (count > 1) {
                    results_cache["MultiRobotTeams"] = true;
                }
            }

            if (Object.keys(teamcounts).length == 1) {
                // SingleTeamOnly
                results_cache["SingleTeamOnly"] = true;
            }
        }

        if (!results_cache.teams) {
            results_cache.teams = results.teams.reduce((acc, x, idx)=>{
                x.participants.forEach((t, ridx) => {
                    let rowspan = false;
                    if (x.participants.length > 1) {
                        if (ridx > 0) rowspan = -x.participants.length;
                            else rowspan = x.participants.length;
                    }
                    var pos = idx + 1;
                    acc.push({
                        class: "pos-" + pos,
                        value: [
                            {
                                value: pos,
                                class: "pos",
                                rowspan: rowspan
                            },
                            tagsafe(t.teamName),
                            (t.minLifespan.toFixed(2) == t.maxLifespan.toFixed(2)
                                ? t.minLifespan.toFixed(2)
                                : t.minLifespan.toFixed(2) +
                                    ' / ' +
                                    t.maxLifespan.toFixed(2)),
                            t.averageHealth,
                            t.averageAccuracy.toFixed(2) + '%'
                        ]}
                    );
                });
                return acc;
            }, []);
        }
    }

    const draw_results = (options) => {
        let cw = ctx.canvas.width,
            Edges = [];

        if (!options) options = {};
        if (!options.maxWidth) options.maxWidth = 1.2;

        var render = new Set();

        render.add("robots");

        if (results_cache.MultiRobotTeams && !results_cache.SingleTeamOnly) {
            // only render teams when its possible to distinguish teams and robots
            render.add("teams");
        }

        if (render.has("robots")) {
            let _Edges = layer_html("results-robots",
                styles_shared +
                '<table id="ranks" width="100%">' +
                    '<tr><th colspan="6">' +
                        'Round Results: Robots' +
                    '</th></tr>' +
                    html_row_cells(
                        [
                            "Place",
                            "Robot",
                            "Seconds",
                            "Distance",
                            "Health",
                            "Accuracy"],
                        {"tag": "th"}) +
                    html_row_cells(results_cache.robots) +
                '</table>', {
                    "width":
                        Math.min(
                            cw/render.size,
                            cw/options.maxWidth
                        ) + 1, // px
                    "xmult":
                        render.size == 2 ? 0 : 0.5
                });
            // end: layer_html(results-robots)
            if (_Edges) Edges.push(_Edges);
        }

        if (render.has("teams")) {
            let _Edges = layer_html("results-teams",
                styles_shared +
                '<table id="ranks" width="100%">' +
                    '<tr><th colspan="5">' +
                        'Round Results: Teams' +
                    '</th></tr>' +
                    html_row_cells(
                        ["Place", "Teams",
                            "Min / Max (s)",
                            "Avg Health",
                            "Avg Accuracy"],
                        {"tag": "th"}) +
                    html_row_cells(results_cache.teams) +
                '</table>', {
                    "width":
                        Math.min(
                            cw/render.size,
                            cw/options.maxWidth
                        ) + 1, // px
                    "xmult":
                        render.size == 2 ? 1 : 0.5
                });
            // end: layer_html(results-team)
            if (_Edges) Edges.push(_Edges);
        }

        if (Edges.length > 0) {
            let LTRB = new Array(4);

            for (let i=Edges.length-1; i>-1; i--) {
                LTRB[0] = (typeof LTRB[0] == "undefined" ?
                    Edges[i][0] : Math.min(LTRB[0], Edges[i][0]));
                LTRB[1] = (typeof LTRB[1] == "undefined" ?
                    Edges[i][1] : Math.min(LTRB[1], Edges[i][1]));
                LTRB[2] = (typeof LTRB[2] == "undefined" ?
                    Edges[i][2] : Math.max(LTRB[2], Edges[i][2]));
                LTRB[3] = (typeof LTRB[3] == "undefined" ?
                    Edges[i][3] : Math.max(LTRB[3], Edges[i][3]));
            }

            return LTRB;
        } else {
            return false;
        }
    }

    const text_center = (text, Options) => {
        let cw = ctx.canvas.width,
            ch = ctx.canvas.height,
            Settings = Object.assign({
                size: ch/3.8,
                color: 'rgba(255,255,255)',
                shadowColor: 'rgba(0,0,0,0)',
                shadowBlur: 0,
                fontfamily: fontfamily,
            }, Options || {});
        ctx.font = Settings.size + 'px ' + Settings.fontfamily;
        ctx.fillStyle = Settings.color;
        ctx.shadowBlur = Settings.shadowBlur;
        ctx.shadowColor = Settings.shadowColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cw/2, ch/2);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'rgba(0,0,0,0)';
    };

    return {
        update: (frame, robots) => {
            if (frame < currentFrame) {
                // dev: when seeking/rewinding replays
                State.explodingRobots = [];
                State.shockedRobots = [];
                currentFrame = false;
            }
            currentFrame = frame;
            robotById = robots;
            robot_count = Object.keys(robots).length;
            return State;
        },
        reset: () => {
            Animator.Factory.clear_saved_states();
            State.explodingRobots = [];
            State.shockedRobots = [];
            currentFrame = false;
            robotById = {};
            robot_count = 0;
        },
        background: () => {
            if (!State.spritesLoaded) return;
            let cw = ctx.canvas.width,
                ch = ctx.canvas.height;
            EntitySprites.as_pattern
                (ctx, "floor",
                cw, ch,
                ((cw % 64) - 64) / 2,
                ((ch % 64) - 64) / 2);
        },
        render: () => {
            if (currentFrame === false) return;
            if (!State.spritesLoaded) return;
            if (!robot_count) return;

            // turn off smoothing for pixel art
            // preserve state for restore later
            let _smoothingEnabled = ctx.imageSmoothingEnabled;
            ctx.imageSmoothingEnabled = false;

            Object.values(robotById).forEach(robot => {
                sprite_robot_body(robot.id);
            });

            // exploding robots

            State.explodingRobots =
                State.explodingRobots.filter(id => id in robotById);

            State.explodingRobots.forEach(id => {
                sprite_robot_explosion(id);
            });

            // shocked robots

            State.shockedRobots =
                State.shockedRobots.filter(id => id in robotById);

            State.shockedRobots.forEach(id => {
                sprite_robot_shock(id);
            });

            ctx.imageSmoothingEnabled = _smoothingEnabled;
        },
        explode_robot: (id) => {
            if (State.explodingRobots.includes(id)) return;
            State.explodingRobots.push(id);
        },
        shock_robot: (id) => {
            if (State.shockedRobots.includes(id)) return;
            State.shockedRobots.push(id);
        },
        // [st]ate, re: battle/utils.js for convention
        hud: (st, worldState) => {
            let rendered = [];

            if (worldState) {
                // dev: optional, may be rendered elsewhere
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.fillStyle = "#fff";
                ctx.font = ctxStandardFont;
                ctx.textBaseline = 'top';
                ctx.textAlign = 'left';
                var status =
                    toLocalText(new Date(worldState.started)) + ' ' +
                    '+' + worldState.count.rounds + ' round' +
                        (worldState.count.rounds <=1 ? '' : 's') + ', ' +
                    (worldState.count.roundsleft
                        ? 'left: ' + worldState.count.roundsleft + ', '
                        : '') +
                    Lookups.get('status', st.sa) + ': ' +
                    'frame: ' + st.co.fr + ' ' +
                    'secs: ' + st.co.se.toFixed(2);
                ctx.fillText(status, 10, 10);
                rendered.push("world");
            }

            let remaining = Math.ceil(st.ro.re),
                prestart = Math.ceil(st.ro.pr),
                max_secs = 5;
            if (remaining <= 10 && remaining >= 1) {
                text_center(remaining, {
                    color: rgbaGradient([
                            [255,   0,   0, 0.75],
                            [255, 255,   0, 0.75],
                            [  0, 255,   0, 0.75],
                        ], [0, 0.5, 1],
                        Math.min(max_secs, st.ro.re) / max_secs),
                    shadowColor: 'black',
                    shadowBlur: 15,
                });
                rendered.push("remaining");
            } else if (prestart >= 1) {
                text_center(prestart, {
                    color: rgbaGradient([
                            [  0, 255,   0, 0.75],
                            [255, 255,   0, 0.75],
                            [255,   0,   0, 0.75],
                        ], [0, 0.5, 1],
                        Math.min(max_secs, st.ro.pr) / max_secs),
                    shadowColor: 'black',
                    shadowBlur: 15,
                });
                rendered.push("prestart");
            };

            return rendered;
        },
        // [st]ate, re: battle/utils.js for convention
        results: (st, options) => {
            if (
                !('ro' in st) ||
                !('rs' in st.ro) ||
                !st.ro.rs
            ) {
                // clears cache on beginning of new round
                results_cache = {};
                return;
            }

            // clear any explosion
            State.explodingRobots = [];
            State.shockedRobots = [];

            process_results(st.ro.rs);
            // src: simulation.js::determine_round_results

            // return min, max boundaries (LTRB)
            return draw_results(options);
        },
        reset: () => {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(
                0, 0,
                ctx.canvas.width,
                ctx.canvas.height);
        },
    }
})(context, fontfamily, fontsize);

} // createArenaVisuals()
