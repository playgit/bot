const OverlayManager = (() => {
    let CachedParameters = false,
        defaultOverlay = "/artwork/square.ebotmasters-logo.png",
        Overlay = false,
        Preloaders = [],
        prev_frame = false,
        _process = () => {};

    const _preload_next = () => {
        if (Preloaders.length > 0) {
            Preloaders.pop()();
        }
    };

    const _standardise = (Arr, preload) => {
        if (typeof(preload) == "undefined") preload = "sequential";

        Arr = Arr.map(
            Key => {
                let Payload = {};
                if (typeof Key == "string") {
                    Payload.src = Key;
                    Payload.rotation = 0;
                } else if (Array.isArray(Key)) {
                    Payload.src = Key[0];
                    Payload.rotation = Key[1] || 0;
                } else if (typeof Key == "object") {
                    // support legacy "overlay" property
                    if ("overlay" in Key) {
                        Key.src = Key.overlay;
                        delete Key["overlay"];
                    }
                    // idempotent form
                    Payload = Key;
                };

                if (Payload.src.toUpperCase() == "BLANK") {
                    // tranparent 1x1 gif
                    Payload.src =
                        "data:image/gif;base64,R0lGODlhAQABAIAAAP///"
                      + "wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
                }

                if (preload &&
                        !("Image" in Payload) &&
                        !("_loader" in Payload)) {

                    Payload._loader = new Image();
                    Payload._loader.addEventListener("load", () => {
                        Payload.Image = Payload._loader;
                        // console.log("[overlay] loaded", Payload.src);
                        if (preload == "sequential") _preload_next();
                    });
                    Payload._loader.addEventListener("error", () => {
                        console.log("[overlay] error", Payload.src);
                        if (preload == "sequential") _preload_next();
                    });

                    let load = () => { Payload._loader.src = Payload.src; };
                    if (preload == "sequential") {
                        // add queue item
                        Preloaders.push(load);
                    } else {
                        // immediately start preloading
                        load();
                    }
                };

                return Payload;
            }
        );

        return Arr;
    };

    defaultOverlay = _standardise([defaultOverlay])[0];

    function setOverlays() {
        CachedParameters = Array.from(arguments);
        CachedParameters[0] = _standardise(CachedParameters[0]);
        _preload_next();
    };

    const _setup = (Arr, onframes, loop) => {
        prev_frame = -1;

        if (onframes) {
            // sequential list - forward, or forward-reverse
            if (!loop) loop = "forward";
            let idx = -1,
                step = 1,
                len = Arr.length,
                _next = () => {
                    idx += step;
                    if (idx >= len) {
                        if (loop == "forward") {
                            // one-way
                            idx = 0;
                        } else {
                            step = -step; // switch direction
                            idx = Math.max(0, len - 2); // cap
                        }
                    }
                    if (idx < 0) {
                        if (loop == "forward") {
                            // dev: error state
                            idx = 0;
                            step = 1;
                        } else {
                            step = -step // switch direction
                            idx = Math.min(1, len - 1); // cap
                        }
                    }
                    Overlay = Arr[idx];
                };

            _process = (f) => {
                if (f % onframes == 0) _next();
            }
        } else if (Arr[0] && 'on' in Arr[0]) {
            // keyframes
            let len = Arr.length;
                from = 0;
            _process = (f) => {
                for (let i=from; i<len; i++) {
                    if (f >= Arr[i]["on"]) {
                        Overlay = Arr[i];
                        from=i+1; // dev: skip keyframe on next
                    }
                }
            }
        }
    };

    const _display = () => {
        if (!Overlay) return;

        if (('Image' in Overlay)) {
            window.__Renderer.set_overlay(Overlay);
        } else {
            if ('_loader' in Overlay) {
                Overlay._loader.addEventListener("load", ()=>{
                    // display when loaded
                    window.__Renderer.set_overlay(Overlay);
                });
            } else {
                // was not preloaded, load now
                Overlay._loader = new Image();
                Overlay._loader.onload = () => {
                    Overlay.Image = Overlay._loader;
                    window.__Renderer.set_overlay(Overlay);
                };
                Overlay._loader.src = Overlay.src;
            }
        };
    };

    const atFrame = (this_frame) => {
        _preload_next();

        // catch-up on page load
        // dev: not all frames are sent to clients
        if (prev_frame === false) _setup(...CachedParameters);
        // reset frame counter on re-init
        if (this_frame < prev_frame) _setup(...CachedParameters);

        Overlay = false;
        for(let f=prev_frame; f<this_frame; f++) _process(f);
        // prevent multiple loads when catching-up
        if (Overlay) {
            console.log("[overlay] trigger", this_frame, Overlay);
            _display();
        }

        prev_frame = this_frame;
    };

    const reset = () => {
        _setup(...CachedParameters);
        Overlay = defaultOverlay;
        console.log("[overlay] default", defaultOverlay);
        _display();
    };

    const setDefault = (newdefault) => {
        defaultOverlay = newdefault;
        _preload_next();
    };

    return {
        setDefault: setDefault,
        setOverlays: setOverlays,
        reset: reset,
        atFrame: atFrame,
    };
})();

OverlayManager.setOverlays([
    "/artwork/square.ebotmasters-logo.png",
    ["/artwork/square.ebotmasters-logo.png", Math.PI/2],
    ["/artwork/square.ebotmasters-logo.png", Math.PI],
    ["/artwork/square.ebotmasters-logo.png", Math.PI*3/2],
], 75);

OverlayManager.setOverlays([
    {
        src: "/artwork/square.ebotmasters-logo.ring.10g.png",
        on: 0,
    },
    {
        src: "/artwork/square.ebotmasters-logo.ring.10y.png",
        on: 1800,
    }
]);
