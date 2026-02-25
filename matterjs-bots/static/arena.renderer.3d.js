window.addEventListener('load', () => {

BABYLON.ParticleHelper.BaseAssetsUrl = "/localcdn/assets.babylonjs.com/particles"
BABYLON.ParticleSystemSet.BaseAssetsUrl = "/localcdn/assets.babylonjs.com/particles"

window.__Renderer = (() => {
    // https://playground.babylonjs.com/#SRZRWV#805

    let Arena = {
            Canvas: document.querySelector("#arena"),
            Engine: false,
            Scene: false,
            Simulation: {
                Dimensions: [false, false],
                Center : [false, false],
                framerate: 15,
                instantfps: 15,
                _lastframe: false,
                _framerates: [],
            },
            World: {
                RenderDimensions: [false, false],
                Viewport: false,
                aspectratio: false,
                framerate: 60,
                scale: 0.1, // to simulation
                wallheight: 10,
                Dimensions: [false, false],
                Center: [false, false],
                diagonal: false,
            },
            Mesh: {
                Ground: false,
                Walls: [],
            },
            CameraManager: false,
            Animator : false,
            Lighting : {
                Ambient: [],
                Directional: [],
            },
            Shadows: [],
            Glow: false,
            status : false,
            battlestate: false,
        },

        RobotManager = {},
        VisualManager = {},
        Projectiles = {};

    let ComponentOptions = {};

    // init canvas
    Arena.Canvas.style.width="100%";
    Arena.Canvas.style.height="100%";
    Arena.Canvas.addEventListener("wheel", e => {
        e.preventDefault();
    });

    // init babylonjs shared components
    Arena.Engine = new BABYLON.Engine(Arena.Canvas, true),
    Arena.Scene = new BABYLON.Scene(Arena.Engine);

    const noop = () => {};

    const asset_projectile = (id) => {
        let mat = new BABYLON.StandardMaterial("projectileMaterial");
        mat.diffuseColor = BABYLON.Color3.White();
        mat.emissiveColor = BABYLON.Color3.Red();
        let Mesh = BABYLON.MeshBuilder
            .CreateSphere(
                id, {
                    diameter: 0.8,
                    segments: 16
                });
        Mesh.material = mat;
        return Mesh;
    };

    const setup_walls = () => {
        Arena.Mesh.Walls = [
            // east
            BABYLON.MeshBuilder.CreatePlane(
                "plane", {
                    height: Arena.World.wallheight,
                    width: Arena.World.Dimensions[0],
                }
            ),
            // west
            BABYLON.MeshBuilder.CreatePlane(
                "plane", {
                    height: Arena.World.wallheight,
                    width: Arena.World.Dimensions[0],
                }
            ),
            // north
            BABYLON.MeshBuilder.CreatePlane(
                "plane", {
                    height: Arena.World.wallheight,
                    width: Arena.World.Dimensions[1],
                }
            ),
            // south
            BABYLON.MeshBuilder.CreatePlane(
                "plane", {
                    height: Arena.World.wallheight,
                    width: Arena.World.Dimensions[1],
                }
            )
        ]

        // east
        Arena.Mesh.Walls[0].position.z = Arena.World.Center[1];
        // Arena.Mesh.Walls[1].rotation.y = BABYLON.Tools.ToRadians(0)

        // west
        Arena.Mesh.Walls[1].position.z = -Arena.World.Center[1];
        Arena.Mesh.Walls[1].rotation.y = BABYLON.Tools.ToRadians(180)

        // north
        Arena.Mesh.Walls[2].position.x = -Arena.World.Center[0];
        Arena.Mesh.Walls[2].rotation.y = BABYLON.Tools.ToRadians(270)

        // south
        Arena.Mesh.Walls[3].position.x = Arena.World.Center[0];
        Arena.Mesh.Walls[3].rotation.y = BABYLON.Tools.ToRadians(90)

        let mat = new BABYLON.StandardMaterial("defaultWall");

        mat.diffuseTexture = new BABYLON
            .Texture("/artwork/plate.64x64.png");
        mat.diffuseTexture.uScale=14;
        mat.diffuseTexture.vScale=1.4;
        mat.diffuseTexture.uOffset=0.5;
        mat.diffuseTexture.vOffset=0.5;

        mat.bumpTexture = new BABYLON
            .Texture("/artwork/plate.64x64.n.png");
        mat.bumpTexture.uScale=14;
        mat.bumpTexture.vScale=1.4;
        mat.bumpTexture.uOffset=0.5;
        mat.bumpTexture.vOffset=0.5;

        for (let i = Arena.Mesh.Walls.length-1; i>-1; i--) {
            Arena.Mesh.Walls[i].position.y = Arena.World.wallheight/2;
            Arena.Mesh.Walls[i].receiveShadows = true;
            Arena.Mesh.Walls[i].material = mat;
        }
    }

    const setup_ground = () => {
        Arena.Mesh.Ground = BABYLON.MeshBuilder.CreateGround(
            "ground", {
                width: Arena.World.Dimensions[0],
                height: Arena.World.Dimensions[1]
            });

        const mat = new BABYLON.StandardMaterial("groundMaterial");

        mat.diffuseTexture = new BABYLON.Texture(
            "/artwork/plate.64x64.png");
        mat.diffuseTexture.uScale=14;
        mat.diffuseTexture.vScale=14;
        mat.diffuseTexture.uOffset=0.5;
        mat.diffuseTexture.vOffset=0.5;

        mat.bumpTexture = new BABYLON.Texture(
            "/artwork/plate.64x64.n.png");
        mat.bumpTexture.uScale=14;
        mat.bumpTexture.vScale=14;
        mat.bumpTexture.uOffset=0.5;
        mat.bumpTexture.vOffset=0.5;

        Arena.Mesh.Ground.material = mat;
        Arena.Mesh.Ground.receiveShadows = true;
    };

    const setup_lighting = () => {
        let ListLights = [
            {
                // bottom-left
                direction: new BABYLON.Vector3(1, -1, 1),
                position: new BABYLON.Vector3(
                    -Arena.World.Center[0],
                    Arena.World.wallheight,
                    -Arena.World.Center[1]
                )
            },
            {
                // top-right
                direction: new BABYLON.Vector3(-1, -1, -1),
                position: new BABYLON.Vector3(
                    Arena.World.Center[0],
                    Arena.World.wallheight,
                    Arena.World.Center[1]
                )
            },
            {
                // top-left
                direction: new BABYLON.Vector3(1, -1, -1),
                position: new BABYLON.Vector3(
                    -Arena.World.Center[0],
                    Arena.World.wallheight,
                    Arena.World.Center[1]
                )
            },
            {
                // bottom-right
                direction:new BABYLON.Vector3(-1, -1, 1),
                position: new BABYLON.Vector3(
                    Arena.World.Center[0],
                    Arena.World.wallheight,
                    -Arena.World.Center[1]
                )
            },
        ];

        for (let i=ListLights.length-1; i>-1; i--) {
            let light = ListLights[i],
                DLight = new BABYLON.DirectionalLight(
                    "directional" + i, light.direction);

            DLight.intensity = 0.35;
            DLight.position = light.position;

            // debug: visible indicator for directional light
            // Indicator = asset_sphere("light_sphere" + i, { diameter: 3 });
            // Indicator.position = DLight.position;

            Arena.Lighting.Directional.push(DLight);

            // setup shadows

            let Shadow = new BABYLON.ShadowGenerator(128, DLight);

            Shadow.useExponentialShadowMap = true;

            Arena.Shadows.push(Shadow);
        }

        console.log(
            "[renderer.3d]",
            "directional lights:", Arena.Lighting.Directional.length,
            "shadow generators:", Arena.Shadows.length);

        Arena.Glow = new BABYLON.GlowLayer("glow");
        Arena.Glow.intensity = 0.5;
    }

    const refresh_projectiles = (state) => {
        let Tracked = [];

        for (let i = state.length - 1; i>-1; i--) {
            let obj = state[i]
                id = "" + obj.id, // dev: must be string
                Mesh = false,
                Position = new BABYLON.Vector3(
                    (obj.ce[0] - Arena.Simulation.Center[0])
                        * Arena.World.scale,
                    0.4,
                    (Arena.Simulation.Dimensions[1]
                        - obj.ce[1] - Arena.Simulation.Center[1])
                        * Arena.World.scale
                );

            if (Projectiles[id]) {
                Mesh = Projectiles[id];
                Arena.Animator.Animate(
                    "P" + id, Mesh, {
                        position: Position
                    },
                    Arena.World.framerate/Arena.Simulation.framerate,
                    Arena.World.framerate
                );
            } else {
                Mesh = asset_projectile(id);
                Mesh.position = Position;
                Projectiles[id] = Mesh;
            }

            Tracked.push(id);
        }

        // remove orphans
        let Existing = Object.keys(Projectiles);
        for (let i = Existing.length - 1; i>-1; i--) {
            if (!Tracked.includes(Existing[i])) {
                Projectiles[Existing[i]].dispose();
                delete Projectiles[Existing[i]];
            }
        }
    }

    const setup_scene = (() => {
        let ALREADY_RUN = false;

        return () => {
            if (ALREADY_RUN) return;
            ALREADY_RUN = true;

            setup_lighting();
            setup_ground();
            setup_walls();

            Arena.Animator = AnimatorSetup(
                Arena, ComponentOptions.Animator);

            Arena.CameraManager = CameraSetup(
                Arena, ComponentOptions.CameraManager);

            RobotManager = RobotSetup(
                Arena, ComponentOptions.RobotManager);

            VisualManager = VisualBridge(Arena);

            Arena.Engine.runRenderLoop(function () {
                Arena.Scene.render();
            });

            window.addEventListener("resize", () => {
                Arena.Engine.resize();

                Arena.RenderDimensions = [
                    Arena.Engine.getRenderWidth(),
                    Arena.Engine.getRenderHeight()
                ];

                // https://playground.babylonjs.com/#DWPQ9R#240
                // worldspace to screenspace
                Arena.World.Viewport = Arena.CameraManager
                    .Camera
                    .viewport
                    .toGlobal(
                        Arena.RenderDimensions[0],
                        Arena.RenderDimensions[1]
                    );

                Arena.World.aspectratio = Arena.Engine
                    .getAspectRatio(Arena.CameraManager.Camera);
            });

            window.dispatchEvent(new Event('resize')); // for other handlers
        };
    })();

    const checkpoint_framerates = () => {
        fps = Arena.Engine.getFps();
        if (!isFinite(fps)) return;

        Arena.World.framerate = fps;

        let tsnow = new Date().getTime();
        if (Arena.Simulation._lastframe) {
            let instantfps = 1 / (
                    tsnow - Arena.Simulation._lastframe) * 1000;

            if (instantfps > fps) return;

            Arena.Simulation.instantfps = instantfps;

            Arena.Simulation._framerates.push(
                Arena.Simulation.instantfps);

            // last 30 frames
            Arena.Simulation._framerates = (
                Arena.Simulation._framerates.slice(-30));

            // average 30 frames

            let len = Arena.Simulation._framerates.length,
                sum = 0;

            for (let i=len-1; i>-1; i--) 
                sum += Arena.Simulation._framerates[i];

            Arena.Simulation.framerate = sum/len;
        }
        Arena.Simulation._lastframe = tsnow;

        // console.log(
        //     "[renderer.3d] framerates", 
        //     Arena.World.framerate, Arena.Simulation.framerate);
    };

    const set_canvas = (width, height, wall) => {
        // server simulation

        Arena.Simulation.Dimensions = [
            width,
            height
        ];

        Arena.Simulation.Center = [
            width/2,
            height/2
        ];

        // recalculate renderer dimensions
        // dev: all positions from simulation should be scaled

        Arena.World.Dimensions = [
            width * Arena.World.scale,
            height * Arena.World.scale,
        ];

        Arena.World.Center = [
            Arena.World.Dimensions[0] / 2,
            Arena.World.Dimensions[1] / 2
        ];

        // diagonal length
        Arena.World.diagonal = Math.hypot(
            Arena.World.Dimensions[0],
            Arena.World.Dimensions[1]
        );

        console.log("[renderer.3d] Arena", Arena);

        setup_scene();
    }

    const render_frame = (ro, pr, se, wa, arenaState, worldState, options) => {
        RobotManager.update(ro, se);
        RobotManager.render();

        refresh_projectiles(pr);

        let new_status = arenaState.text_status;

        if (new_status != Arena.status) {
            // on state changes
            if (
                Arena.status == false
                && ['running', 'paused', 'waiting'].includes(new_status)
            ) {
                // page load during active/paused battle
                console.log("[renderer.3d] page loaded/refreshed");
                Arena.CameraManager.stage();
            } else if (
                Arena.status == "running"
                && new_status == "waiting"
            ) {
                // round has ended
                console.log("[renderer.3d] round ended");
                Arena.CameraManager.topdown();
            }
            // update current status
            Arena.status = new_status;
        }

        // dev: track sub-states during a battle
        if (['running', 'paused', "waiting"].includes(Arena.status)) {
            if (arenaState.ro.rs) {
                if (Arena.battlestate != "results") {
                    if (VisualManager.State.results) {
                        // [run once] results drawn
                        Arena.battlestate = "results";
                        Arena.CameraManager.topdown({
                            radius: VisualManager.State.results[4].radius,
                            frames: Arena.World.framerate/2,
                        });
                    }
                }
                // results available
                if (VisualManager.State.results
                        && VisualManager.State.results[4]) {
                    // dev: LTBR[ForR]
                    Arena.CameraManager.single(
                        "radius",
                        VisualManager.State.results[4].radius,
                        { frames: Arena.World.framerate/2 }
                    );
                }
            } else if (arenaState.ro.pr > 0) {
                if (Arena.battlestate != "prestart") {
                    // [run once] pre-battle countdown started
                    Arena.battlestate = "prestart";
                    Arena.CameraManager.topdown();
                }
                // start countdown running
            } else {
                if (arenaState.ro.re > 0 && arenaState.ro.re <= 10) {
                    if (Arena.battlestate != "ending") {
                        Arena.battlestate = "ending";
                        Arena.CameraManager.topdown({
                            frames: Arena.World.framerate/2,
                        });
                    }
                    // end countdown running
                } else if (Arena.battlestate == "prestart") {
                    // [run once] battle started
                    Arena.battlestate = "started";
                    Arena.CameraManager.stage();
                } else {
                    // battle is running
                    Arena.CameraManager.action(
                        Arena, RobotManager.Action
                    );
                }
            }
        }

        VisualManager.render(arenaState);

        checkpoint_framerates();
    };

    const set_component_options = (key, value) => {
        ComponentOptions[key] = value;
    };

    const _safecall = (obj, method, params) => {
        // dev: early-calling safety
        if (typeof obj == "undefined") return;
        if (!(method in obj)) return;
        if (!params) params = [];
        return obj[method](...params);
    };

    Arena.Canvas.addEventListener('click', ()=>{
        // RobotManager.explode();
        // RobotManager.shock();
    });

    document.querySelectorAll(".fit-arena").forEach(el => {
        el.style.visibility = "hidden";
    });

    return {
        set_component_options: set_component_options,

        RobotManager: () => { return RobotManager; },
        CameraManager: () => { return Arena.CameraManager; },
        VisualManager: () => { return VisualManager; },

        reset_visuals: () => {
            _safecall(RobotManager,
                "reset") },
        set_canvas: set_canvas,
        set_edges: noop,

        render_frame: render_frame,

        explode_robot: (id) => {
            _safecall(RobotManager,
                "explode", [id]) },
        shock_robot: (id) => {
            _safecall(RobotManager,
                "shock", [id]) },

        set_overlay: (path) => {
            _safecall(VisualManager,
                "set_overlay", [path]) },
    }
})();

});
