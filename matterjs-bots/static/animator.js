let AnimatorFactories = () => {
    var states = {}

    load_state = (id) => {
        if (!id) return {};
        return states[id] || {};
    };

    save_state = (id, state) => {
        if (!id) return false;
        states[id] = state;
        return true;
    };

    delete_state = (id) => {
        if (!id) return false;
        delete states[id];
    }

    return {
        get_saved_states: () => { return states },
        clear_saved_states: () => { states = {} },
        spriteCurrentFrame:  (fw, fh, rate, func) => {
            return (src, tgt, meta) => {
                let state = load_state(meta.id || false),
                    ctick = (meta || {}).tick || false;

                // always process this
                let cols = (src[2] / fw),
                    rows = (src[3] / fh),
                    frames = cols * rows,
                    cframe = false;

                if (!('frameindex' in state)
                        || !ctick || !state.tick
                        || ctick - state.tick >= rate) {
                    // update frame
                    cframe = func(state['frameindex'], frames, ctick, meta);
                    if (cframe < 0 || cframe > frames) {
                        // out of bound frame index
                        meta.norender = true;
                        delete_state(meta.id);
                        return;
                    }
                    // persist state
                    state["frameindex"] = cframe;
                    state["tick"] = ctick;
                } else {
                    cframe = state["frameindex"];
                }

                let fx = cframe % cols * fw,
                    // handle special case where rows = 1
                    // otherwise last frame y will be on non-existent row
                    fy = Math.floor(cframe / Math.max(2, rows)) * fh;

                src[0] = fx;
                src[1] = fy;
                src[2] = fw;
                src[3] = fh;

                save_state(meta.id || false, state);
            };
        },
        scaler: (scale) => {
            return (src, tgt) => {
                tgt[2] = tgt[2] * scale;
                tgt[3] = tgt[3] * scale;
            }
        }
    }
}

let Animator = (Sprites, callback) => {
    let loaded = 0,
        total = 0;

    Object.keys(Sprites).forEach(k => {
        var v = Sprites[k];
        if (typeof v == "string") {
            Sprites[k] = {
                "src": v
            }
        } else if (Array.isArray(v)) {
            Sprites[k] = {
                "src": v.shift(),
                "before": v
            }
        }

        // load image asset

        Sprites[k].current = new Image();
        total++;
        var src = Sprites[k].src;
        Sprites[k].current.onload = () => {
            loaded++;
            console.log("sprite loaded:", k);
            if (callback && loaded >= total) callback(loaded);
        };
        Sprites[k].current.src = src;
    });

    return {
        as_pattern: (ctx, spriteId, cw, ch, offsetx, offsety) => {
            if (!('pattern' in Sprites[spriteId])) {
                Sprites[spriteId].pattern = ctx.createPattern(
                    Sprites[spriteId].current, 'repeat');
                    console.log("pattern created, sprite:", spriteId);
            }
            offsetx = offsetx || 0;
            offsety = offsety || 0;
            ctx.fillStyle = Sprites[spriteId].pattern;

            // dev: fillRect(-x, -y) does not seem to offset top-left
            ctx.translate(offsetx, offsety);
            ctx.fillRect(0, 0, cw - offsetx, ch - offsety);
            ctx.translate(-offsetx, -offsety);
        },
        to_canvas: (ctx, spriteId, cx, cy, cw, ch, cang, meta) => {
            // generic renderer for sprites
            // all parameters are based on target canvas

            let img = Sprites[spriteId],
                src = [0, 0, img.current.width, img.current.height],
                tgt = [cx, cy, cw, ch, cang];

            meta = Object.assign({}, meta);

            // add time component (tick) if not supplied
            if (!('tick' in meta)) meta.tick = (new Date()).getTime();

            // pre-process
            if (img.before) img.before.forEach(f => f(src, tgt, meta));

            // pre-process can turn-off rendering if required
            if (!("norender" in meta) || !meta.norender) {
                ctx.translate(tgt[0], tgt[1]); // rotate around this center
                ctx.rotate(tgt[4]);  // do the rotation

                ctx.drawImage(
                    img.current,
                    src[0], src[1], src[2], src[3],
                    -tgt[2]/2, -tgt[3]/2, tgt[2], tgt[3]);

                // undo translations and rotations
                ctx.rotate(-tgt[4]);
                ctx.translate(-tgt[0], -tgt[1]);
            }

            // post-process
            if (img.after) img.after.forEach(f => f(src, tgt, meta));
        }
    }
}

// singleton, state is shared across all factories
Animator.Factory = AnimatorFactories();
