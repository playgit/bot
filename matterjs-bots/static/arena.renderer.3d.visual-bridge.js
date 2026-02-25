const VisualBridge = (Arena) => {
    let requireRefresh = true, // force first update
        State = {},
        activeOverlay = false,
        PlaneVisuals = false,
        Context = false,
        arenaVisuals = false;

    // add additional plane on top of arena with dynamic texture

    // dynamic texture
    Arena.Texture = {
        DynamicFloor: new BABYLON.DynamicTexture(
            "arenafloor", {
                width: Arena.Simulation.Dimensions[0],
                height: Arena.Simulation.Dimensions[1]
            })
    };
    Context = Arena.Texture.DynamicFloor.getContext("2d");

    // basic arena visuals object (countdowns, results)
    arenaVisuals = createArenaVisuals(Context);

    // generate new plane based on Ground
    PlaneVisuals = BABYLON.MeshBuilder.CreatePlane(
        "plane", {
            width: Arena.World.Dimensions[0],
            height: Arena.World.Dimensions[1]
        }
    );
    PlaneVisuals.position.y = 0.01;
    PlaneVisuals.rotation.x = BABYLON.Tools.ToRadians(90)

    let mat = new BABYLON.StandardMaterial("VisualPlaneMaterial");
    mat.diffuseTexture = Arena.Texture.DynamicFloor;
    mat.diffuseTexture.hasAlpha = true;
    mat.useAlphaFromDiffuseTexture = true;
    // share bump texture with ground
    PlaneVisuals.material = mat;

    // get a reference to any dynamic lights in the arena
    // dev: mutate with "initial state" for resets

    for (let i=Arena.Lighting.Directional.length-1; i>-1; i--) {
        Arena.Lighting.Directional[i].__initialState = {
            intensity: Arena.Lighting.Directional[i].intensity,
            diffuse: Arena.Lighting.Directional[i].diffuse,
        }
    }

    const _lights_set = (Settings) => {
        for (let i=Arena.Lighting.Directional.length-1; i>-1; i--) {
            let Props = false;
            if (Settings === false) {
                Props = Arena.Lighting.Directional[i].__initialState;
            } else {
                Props = Settings;
            };
            let keys = Object.keys(Props);
            for (j=keys.length-1; j>-1; j--) {
                Arena.Lighting.Directional[i][keys[j]] = Props[keys[j]];
            };
        };
    };

    const _lights = (arenaState) => {
        if (Arena.Lighting.Directional.length <= 0) return;

        let st = arenaState,
            Settings = false;
        // some logic copied from arena-visuals.js::hud
        // dev: duplicated for consistency
        let remaining = Math.ceil(st.ro.re),
            prestart = Math.ceil(st.ro.pr),
            max_secs = 5,
            ratio = false;
        if (remaining <= 10 && remaining >= 1) {
            ratio = Math.min(max_secs, st.ro.re) / max_secs;
        } else if (prestart >= 1) {
            ratio = 1 - Math.min(max_secs, st.ro.pr) / max_secs;
        };
        if (ratio !== false) {
            let rgb = rgbaGradient([
                [255,   0,   0,   1],
                [255, 255,   0,   1],
                [  0, 255,   0,   1],
            ], [0, 0.5, 1], ratio, "ratios");
            rgb.pop(); // remove alpha

            Settings = {
                diffuse: new BABYLON.Color3(...rgb),
            };
        }
        _lights_set(Settings);
    };

    const _update = () => {
        Arena.Texture.DynamicFloor.update();
    };

    const _reset = () => {
        arenaVisuals.reset();

        if (activeOverlay) {
            let oW = activeOverlay.Image.width,
                oH = activeOverlay.Image.height,
                oA = ("rotation" in activeOverlay) ?
                    activeOverlay.rotation : 0;

            Context.translate(
                Arena.Simulation.Center[0],
                Arena.Simulation.Center[1]
            );
            Context.rotate(oA);
            Context.drawImage(activeOverlay.Image, -oW/2, -oH/2, oW, oH);
            Context.rotate(-oA);
            Context.translate(
                -Arena.Simulation.Center[0],
                -Arena.Simulation.Center[1]
            );
        }
    };

    const ResultsFrame = (() => {
        let Mesh = false,
            Dims = [false, false];

        const get = (pixelWidth, pixelHeight) => {
            if (Mesh) {
                if (pixelWidth == Dims[0] && pixelHeight == Dims[1]) {
                    // already created and same dimensions
                    return Mesh;
                }
            }
            Dims = [pixelWidth, pixelHeight];

            dispose();

            Mesh = BABYLON.MeshBuilder.CreatePlane(
                "plane", {
                    width: pixelWidth * Arena.World.scale,
                    height: pixelHeight * Arena.World.scale,
                }
            );

            Mesh.position.y = 0.01;
            Mesh.rotation.x = BABYLON.Tools.ToRadians(90)
            Mesh.setEnabled(false);

            // let mat = new BABYLON.StandardMaterial("test");
            // mat.alpha = 0;
            // Mesh.material = mat;

            return Mesh;
        };

        const dispose = () => {
            if (Mesh) Mesh.dispose();
        };

        const paint = (pixelLTRB) => {
            let Plane = get(
                    pixelLTRB[2] - pixelLTRB[0],
                    pixelLTRB[3] - pixelLTRB[1]
                ),
                PlaneBB = Plane.getBoundingInfo().boundingBox,
                worldwidth = PlaneBB.maximumWorld.x - PlaneBB.minimumWorld.x,
                worldheight = PlaneBB.maximumWorld.y - PlaneBB.minimumWorld.y;

            return Arena.CameraManager
                .calculateFit(worldwidth, worldheight);
        }

        return {
            paint: paint,
            dispose: dispose,
        }
    })();

    const render = (arenaState) => {
        if (requireRefresh) _reset();

        // dev: allow render() to be called without parameters
        //  useful to paint a fixed overlay
        if (typeof arenaState == "undefined")
            arenaState = {ro: {re: false, pr: false}};

        // track the draw states, == False if not drawn
        State.hud = arenaVisuals.hud(arenaState),
        State.results = arenaVisuals.results(arenaState, {maxWidth: 1.0});

        let isRendered = !!(State.hud.length > 0) || !!State.results;

        // update on change, and when switching states
        if (isRendered || requireRefresh != isRendered) {
            // extra effects
            _lights(arenaState);
            _update();

            if (State.results) {
                // add preferred fov, radius to LTBR => LTBR[ForR]
                State.results.push(ResultsFrame.paint(State.results))
            } else {
                ResultsFrame.dispose();
            }
        }

        requireRefresh = isRendered;

        return State;
    };

    const set_overlay = (Overlay) => {
        if (!Overlay) return;
        if (typeof Overlay == "string") {
            // support loading images directly from path
            let temp = new Image();
            temp.onload = () => {
                activeOverlay = {
                    "Image": temp,
                }
                requireRefresh = true;
                render();
            };
            temp.src = Overlay;
            return;
        };
        if (!('Image' in Overlay)) return;

        activeOverlay = Overlay;

        requireRefresh = true; // update
    };

    return {
        State: State,

        set_overlay: set_overlay,
        render: render,
    }
}; // VisualBridge(...)
