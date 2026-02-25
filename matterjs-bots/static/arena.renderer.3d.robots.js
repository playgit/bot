/*

&3d.robots.UseAsset=CHICKEN
    replace default robot asset with preconfigured asset
&3d.robots.UseAsset=CUSTOM:/meshes/pixel_space_ship.glb:0
    CUSTOM:<src>:<base angle, degrees>[:<maxSize>]
    add a custom asset from src and replace robot asset
&3d.robots.RobotGizmos=1
    enables debug gizmos on robots
&3d.robots.ShowReference=1
    renders robot reference mesh at world origin
&3d.robots.ReferenceGizmo=1
    render refence gizmo, ignored if not 3d.robots.ShowReference
&3d.robots.AddActionMesh=1
    render helper mesh for center of action
&3d.robots.RobotSize=3
    overrides default robot size, precedence:
        ASSETS
        Options
        3d.robots.RobotSize
        (1.9)

related:
    arena.renderer.3d.animator.js :: &3d.animator.SkipAnimation=1

*/

const RobotSetup = (Arena, Options) => {
    let ASSETS = {
        "ROACH": {
            src: "/localcdn/thingiverse/roach2_fixed_1.stl",
            rotation: Math.PI,
        },
        "CHICKEN": {
            src: "/localcdn/thingiverse/Chicken.stl",
            rotation: Math.PI / 2,
        },
        "DISPLACED-CHICKEN": {
            src: "/meshes/paint3d-chicken.glb",
            rotation: Math.PI / 2,
        },
        "DUCK": {
            src: "/localcdn/cx20.github.io/gltf-test/sampleModels/Duck/glTF-Binary/Duck.glb",
            rotation: Math.PI,
        },
    };

    const urlParams = new URLSearchParams(window.location.search);

    let ROBOT = {},
        Buffer = {},
        RobotMeshes = {},
        RobotIDs = [], // helper for RobotMeshes
        ScanMeshes = {},
        Sprites = {},
        Effects = {},
        Gizmos = {},
        Action = {
            Dimensions: [false, false],
            Center: BABYLON.Vector3.Zero(),
            Mesh: false, // add to debug
        },
        Settings = {
            RobotSize:
                parseInt(urlParams.get("3d.robots.RobotSize")) || 2.3,
            ShowReference:
                parseInt(urlParams.get("3d.robots.ShowReference")) || false,
            ReferenceGizmo:
                parseInt(urlParams.get("3d.robots.ReferenceGizmo")) || false,
            UseAsset:
                urlParams.get("3d.robots.UseAsset"),
            RobotGizmos:
                parseInt(urlParams.get("3d.robots.RobotGizmos")),
            AddActionMesh:
                parseInt(urlParams.get("3d.robots.AddActionMesh")) || false,
        },
        Events = {};

    // 3d.robots.UseAsset=CUSTOM:/meshes/pixel_space_ship.glb:0
    if (typeof Settings.UseAsset == "string" 
            && Settings.UseAsset.startsWith("CUSTOM:")) {

        // allow loading of meshes from other sources
        // dev: cors must still be respected!
        Settings.UseAsset = Settings.UseAsset
            .replaceAll("https://", "//")
            .replaceAll("http://", "//");

        let tokens = Settings.UseAsset.split(":");

        if (!tokens[1].toLowerCase().endsWith(".glb")) tokens[1] += ".glb";

        ASSETS["CUSTOM"] = {
            src: tokens[1],
            rotation: parseFloat(tokens[2] || 0)  * Math.PI/180,
        };

        if (tokens[3]) {
            ASSETS["CUSTOM"].size = (
                parseFloat(tokens[3]) || Settings.RobotSize);
        }

        Settings.UseAsset = "CUSTOM";
    };

    // when not supplied, use the last mesh in the ASSETS list
    let ASSET_IDS = Object.keys(ASSETS);
    if (!(Settings.UseAsset in ASSETS))
        Settings.UseAsset = ASSET_IDS[ASSET_IDS.length - 1];

    Settings = Object.assign(Settings, Options || {});

    ROBOT = Object.assign({
        src: false,
        rotation: 0,
        size: Settings.RobotSize,
        BoundingBox: false,
        scale: false,
    }, ASSETS[Settings.UseAsset]);

    const on = (() => {
        let counter = 0;
        return (event, func) => {
            Events[event] = (Events[event] || {});
            Events[event][counter] = func;
            counter++;
            console.log('[3d.robots] registered event', event, counter);
            return counter;
        }
    })();

    const attach_gizmo = (Mesh, Options) => {
        let Gizmo = new BABYLON.GizmoManager(Arena.Scene),
            Settings = Object.assign({
                positionGizmoEnabled: true,
                boundingBoxGizmoEnabled: true,
            }, Options || {});

        Gizmo.enableAutoPicking = false;
        Gizmo.positionGizmoEnabled = Settings.positionGizmoEnabled;
        Gizmo.boundingBoxGizmoEnabled = Settings.boundingBoxGizmoEnabled;

        // disable box click-drag
        Gizmo.boundingBoxDragBehavior.disableMovement = true; 

        // disable axis click-drag
        Gizmo.gizmos.positionGizmo.xGizmo.dragBehavior.detach();
        Gizmo.gizmos.positionGizmo.yGizmo.dragBehavior.detach();
        Gizmo.gizmos.positionGizmo.zGizmo.dragBehavior.detach();

        Gizmo.attachToMesh(Mesh);

        return Gizmo;
    };

    const bounding_box_from_meshes = (Arr) => {
        /* compute bounding box for asset

        * support child meshes
        * dev: use world-space coordinates, local-space coordinates
            may be different due to different scaling for an asset */

        let BB = false,
            min = false,
            max = false;

        Arr.forEach((m, idx) => {
            BB = m.getBoundingInfo().boundingBox;
            let mmin = BB.minimumWorld,
                mmax = BB.maximumWorld,
                pivot = m.getPivotPoint();
            if (mmin.equalsWithEpsilon(mmax, 0.00001)) {
                // do not use 0-sized bounds for calculations
                console.log(
                    "[3d.robots] 0-size",
                    "[" + idx + "]", m.name,
                    "position",
                        m.position.x, m.position.y, m.position.z,
                    "pivot",
                        pivot.x, pivot.y, pivot.z,
                    "centerW",
                        BB.centerWorld.x,
                        BB.centerWorld.y,
                        BB.centerWorld.z,
                );
                return;
            };
            console.log(
                "[3d.robots] ref mesh",
                "[" + idx + "]", m.name,
                "position",
                    m.position.x, m.position.y, m.position.z,
                "pivot",
                    pivot.x, pivot.y, pivot.z,
                "centerW",
                    BB.centerWorld.x,
                    BB.centerWorld.y,
                    BB.centerWorld.z,
            );
            if (min === false) {
                min = mmin;
                max = mmax;
            } else {
                min = BABYLON.Vector3.Minimize(min, mmin);
                max = BABYLON.Vector3.Maximize(max, mmax);
            }
        });

        BB = new BABYLON.BoundingInfo(min, max).boundingBox;

        return BB;
    };

    const load_single_mesh = () => {
        BABYLON
            .SceneLoader
            .ImportMeshAsync("", ROBOT.src)
            .then((result) => {
                console.log("[3d.robots] loaded", ROBOT.src);
                  
                ROBOT.MESH = result.meshes[0];

                /* calculate bounding box */

                ROBOT.BoundingBox = bounding_box_from_meshes(result.meshes);

                /* center mesh */

                ROBOT.MESH.position.x -= ROBOT.BoundingBox.centerWorld.x;
                ROBOT.MESH.position.y -= ROBOT.BoundingBox.minimumWorld.y;
                ROBOT.MESH.position.z -= ROBOT.BoundingBox.centerWorld.z;

                ROBOT.MESH.bakeCurrentTransformIntoVertices();

                /* scale, based on width, length (x,z) */

                let ranges = [
                    ROBOT.BoundingBox.maximumWorld.x 
                        - ROBOT.BoundingBox.minimumWorld.x,
                    ROBOT.BoundingBox.maximumWorld.z 
                        - ROBOT.BoundingBox.minimumWorld.z
                ];
                ROBOT.scale = ROBOT.size/Math.max(...ranges);
                ROBOT.MESH.scaling = new BABYLON.Vector3(
                    ROBOT.scale, ROBOT.scale, ROBOT.scale);
                console.log("[3d.robots] ref autoscale =", ROBOT.scale);

                // ROBOT.MESH.bakeCurrentTransformIntoVertices();
                // XXX: misaligns X on STL after baking

                /*
                complete reference initialisation
                affects only canonical parent mesh
                */

                ROBOT.MESH.rotationQuaternion = null;

                // visual display of reference only
                // "rotation modifier" separately applied in render_robots()
                // dev: cannot bake due misaligned STL meshes
                ROBOT.MESH.rotation.y = ROBOT.rotation;

                ROBOT.MESH.setEnabled(Settings.ShowReference);

                if (Settings.ReferenceGizmo) attach_gizmo(ROBOT.MESH);

                if (Events.referenceLoaded) {
                    Object.values(Events.referenceLoaded)
                        .forEach(f => f(ROBOT));
                }
            })
            .catch(err => {
                console.log("[3d.robots] error", ROBOT.src);  

                if (Events.referenceError) {
                    Object.values(Events.referenceError)
                        .forEach(f => f(err, ROBOT));
                }
            })
    };

    const new_robot = (id) => {
        let Mesh = ROBOT.MESH.clone(id);

        Mesh.setEnabled(true);

        for (let i=Arena.Shadows.length-1; i>-1; i--) {
            Arena.Shadows[i].addShadowCaster(Mesh);
        }

        let childmeshes = Mesh.getChildMeshes(),
            childmeshes_mat = childmeshes.filter(m => m.material),
            meshes_mat = [];

        let matActive = new BABYLON.StandardMaterial("matActive");
        matActive.diffuseColor = new BABYLON.Color3(0, 1, 0);
        matActive.alpha = 1;

        let matInactive = new BABYLON.StandardMaterial("matActive");
        matInactive.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        matInactive.alpha = 1;

        if (childmeshes.length == 0) {
            // only one mesh
            console.log(
                "[3d.robots]", "[" + id + "]",
                "single mesh");
            meshes_mat.push(Mesh);
        } else if (childmeshes_mat.length > 0) {
            // has child meshes, some with materials
            console.log(
                "[3d.robots]", "[" + id + "]",
                "child meshes with materials");
            meshes_mat = childmeshes_mat;
        } else {
            // has child meshes, no materials
            console.log(
                "[3d.robots]", "[" + id + "]",
                "child meshes, no materials");
            meshes_mat = childmeshes_mat;
        }

        // setup material if its not present on the mesh
        meshes_mat.forEach(m => {
            if ("material" in m && m.material) return;
            m.material = matActive;
        });

        // mutate mesh apply material helpers
        Mesh.setHealth = (() => {
            let prevratio = true,
                rgb = false,
                prevrgb = false;
            return (ratio) => {
                if (ratio === false) {
                    if (prevratio !== false) {
                        meshes_mat.forEach(m => {
                            m.material = matInactive;
                        });
                    }
                    rgb = false;
                } else {
                    if (ratio === prevratio) return prevrgb;

                    rgb = rgbaGradient([
                        [255,   0,   0,   1],
                        [255, 255,   0,   1],
                        [  0, 255,   0,   1],
                    ], [0, 0.5, 1], ratio, "ratios");
                    rgb.pop();

                    meshes_mat.forEach(m => {
                        m.material.diffuseColor = new BABYLON.Color3(...rgb);
                    });

                    prevrgb = rgb;
                }
                prevratio = ratio;

                return rgb;
            };
        })(1.0);

        return Mesh;
    };

    const get_robot_mesh = (id) => {
        // only explode if robot mesh is available
        if (!(id in RobotMeshes)) return false;
        // get the mesh to position the explosion
        return RobotMeshes[id];
    };

    const run_on_untracked = (Meshes, Tracked, funcRemove) => {
        let Existing = Object.keys(Meshes);
        for (let i = Existing.length - 1; i>-1; i--) {
            if (!Tracked.includes(Existing[i])) {
                Meshes[Existing[i]][funcRemove]();
                delete Meshes[Existing[i]];
            }
        }
    };

    const update = (ro, se) => {
        Buffer = { ro: ro, se: se };
    };

    const render_robots = () => {
        if (!ROBOT.MESH) return; // asset loaded?

        let minmaxX = [99999, -99999],
            minmaxY = [99999, -99999]

        let Tracked = [];
        for (let i = Buffer.ro.length - 1; i>-1; i--) {
            let obj = Buffer.ro[i],
                id = "" + obj.id, // dev: must be string
                Mesh = false,
                Position = new BABYLON.Vector3(
                    (obj.ce[0] - Arena.Simulation.Center[0])
                        * Arena.World.scale,
                    0,
                    (Arena.Simulation.Dimensions[1]
                        - obj.ce[1] - Arena.Simulation.Center[1])
                        * Arena.World.scale
                ),
                angle = ROBOT.rotation + obj.an, // re: rotation modifier
                Rotation = new BABYLON.Vector3(
                    0, angle, 0);

            if (RobotMeshes[id]) {
                Mesh = RobotMeshes[id];
                Arena.Animator.Animate(
                    "R" + id, Mesh, {
                        position: Position,
                        rotation: Rotation,
                    },
                    Arena.World.framerate/Arena.Simulation.framerate,
                    Arena.World.framerate
                );
            } else {
                Mesh = new_robot(id);
                Mesh.position = Position;
                Mesh.rotation = Rotation;
                RobotMeshes[id] = Mesh;

                if (Settings.RobotGizmos)
                    Gizmos[id] = attach_gizmo(Mesh);
            }

            if (obj.ac) {
                let rgb = Mesh.setHealth(obj.rh/100);
                obj.healthRGB = rgb;

                // track "center of action"
                minmaxX[0] = Math.min(minmaxX[0], Mesh.position.x);
                minmaxX[1] = Math.max(minmaxX[1], Mesh.position.x);
                minmaxY[0] = Math.min(minmaxY[0], Mesh.position.z);
                minmaxY[1] = Math.max(minmaxY[1], Mesh.position.z);
            } else {
                Mesh.setHealth(false);
            }

            // dev: mutate with state
            Mesh.__State = obj;

            Tracked.push(id);
        }

        run_on_untracked(RobotMeshes, Tracked, "dispose");

        RobotIDs = Tracked; // re: refresh_sprites()

        let avgX = (minmaxX[0] + minmaxX[1]) / 2,
            avgY = (minmaxY[0] + minmaxY[1]) / 2;

        Action.Center = new BABYLON.Vector3(avgX, 0, avgY);
        Action.Dimensions = [
            minmaxX[1] - minmaxX[0],
            minmaxY[1] - minmaxY[0],
        ];
        Action.rotation = Math.atan2(-avgY, avgX); // re: arena "quadrant"

        if (Action.Mesh) {
            Action.Mesh.position = Action.Center;
            Action.Mesh.position.y = 0.5;
            Action.Mesh.rotation.y = Action.rotation;
            Action.Mesh.scaling = new BABYLON.Vector3(
                Action.Dimensions[0], 1, Action.Dimensions[1]);
        }
    };

    const render_scans = () => {
        if (!ROBOT.MESH) return; // root asset loaded?

        let Tracked = [];
        for (let i = Buffer.se.length - 1; i>-1; i--) {
            let obj = Buffer.se[i],
                id = "" + obj.ri, // dev: must be string
                Mesh = false,
                Position = false, // dev: (Robot).position
                angle = obj.an + Math.PI, // mesh-dependent rotation
                Rotation = new BABYLON.Vector3(0, angle, 0),
                RobotMesh = get_robot_mesh(id), // associated robot mesh
                animate = true;

            // skip until RobotMeshes is available
            if (!RobotMesh) continue;

            if (ScanMeshes[id]) {
                if (ScanMeshes[id].__State.sD == obj.sD) {
                    // same scan distance
                    Mesh = ScanMeshes[id];
                } else {
                    // different scan distance, rebuild mesh
                    ScanMeshes[id].dispose();
                    delete ScanMeshes[id];
                }
            }

            if (!Mesh) {
                // rebuild scan from 2d edges...
                //  manual translation to center on origin,
                //  rotation=0, with pivot offset
                // test: https://playground.babylonjs.com/#4Q9MY3#7

                let scale = Arena.World.scale,
                    edges = obj.ed,
                    angle = obj.an,
                    center = obj.ce,
                    scandist = obj.sD,
                    offset = (scandist/2 + RobotMesh.__State.mD) * scale,
                    cos = Math.cos(-angle),
                    sin = Math.sin(-angle),
                    XYs = new Array(edges.length); // avoid changing obj

                for (j=edges.length-1; j>-1; j--) {
                    let edge = edges[j],
                        x = (edge.x - center[0]) * scale,
                        y = (edge.y - center[1]) * scale;
                    XYs[j] = {
                        x: (cos * x) - (sin * y),
                        y: (cos * y) + (sin * x) + offset
                    };
                };

                Mesh = (new BABYLON.PolygonMeshBuilder(id, XYs)).build();

                // use unique material for each scan for different colors
                let scanMaterial = new BABYLON
                    .StandardMaterial("scanMaterial");

                scanMaterial.alpha = 0.08;
                scanMaterial.emissiveColor = BABYLON.Color3.White();
                Mesh.material = scanMaterial;

                ScanMeshes[id] = Mesh;

                animate = false;
            }

            if (RobotMesh.__State.healthRGB) {
                Mesh.material.emissiveColor = new BABYLON.Color3(
                    ...RobotMesh.__State.healthRGB)
            };

            Position = new BABYLON.Vector3(
                RobotMesh.position.x,
                0.01,
                RobotMesh.position.z
            );

            if (animate) {
                Arena.Animator.Animate(
                    "S" + id, Mesh, {
                        position: Position,
                        rotation: Rotation,
                    },
                    Arena.World.framerate/Arena.Simulation.framerate,
                    Arena.World.framerate
                );
            } else {
                Mesh.position = Position;
                Mesh.rotation = Rotation;
            }

            // dev: mutate with state
            Mesh.__State = obj;

            Tracked.push(id);
        }
        run_on_untracked(ScanMeshes, Tracked, "dispose");
    };

    const render = () => {
        render_robots();
        render_scans();
    };

    const explode = (id) => {
        if (!id) id = "TEST";
        let Mesh = get_robot_mesh(id);
        id = "E" + id; // differentiate effects
        if (id in Effects) return; // play once at a time per robot
        Effects[id] = true; // track effect

        BABYLON.ParticleHelper.CreateAsync("explosion")
            .then((SSet) => {
                // https://doc.babylonjs.com/typedoc/classes/BABYLON.ParticleSystemSet
                if (Mesh) SSet.emitterNode = Mesh;

                let count_systems = false,
                    disposed = 0;

                filtered = [];
                SSet.systems.forEach(PSys => {
                    // dev: remove "debris", speed up animation
                    if (PSys.name == 'debris') return;
                    let speed = 5,
                        spread_limit = 1.5;
                    PSys.minEmitPower = PSys.minEmitPower / (speed * spread_limit);
                    PSys.maxEmitPower = PSys.maxEmitPower / (speed * spread_limit);
                    PSys.updateSpeed = PSys.updateSpeed * speed;
                    // track end of particle set
                    PSys.disposeOnStop = true;
                    PSys.onDisposeObservable.add(()=>{
                        disposed++;
                        if (disposed == count_systems) {
                            delete Effects[id];
                        }
                    });
                    filtered.push(PSys);
                });
                SSet.systems = filtered;
                count_systems = SSet.systems.length;

                SSet.start();
            }
        );
    };

    const shock = (id) => {
        if (!id) id = "TEST";
        let Mesh = get_robot_mesh(id);
        id = "S" + id; // differentiate effects
        if (!Mesh) Mesh = asset_sphere(); // debug: render to center
        if (id in Effects) {
            console.log("effect already running", id);
            return;
        }
        Effects[id] = true; // track effect

        let PSys = BABYLON.ParticleHelper.CreateDefault(Mesh, 300);
        // https://doc.babylonjs.com/typedoc/interfaces/BABYLON.IParticleSystem
        PSys.minLifeTime = 0.5;
        PSys.maxLifeTime = 2;
        PSys.minSize = 0.3;
        PSys.maxSize = 0.7;
        PSys.emitRate = 300;
        PSys.minEmitPower = 4;
        PSys.maxEmitPower = 7;
        PSys.color1 = new BABYLON.Color4(0.7, 0.8, 1.0, 1.0);
        PSys.color2 = new BABYLON.Color4(0.2, 0.5, 1.0, 1.0);
        PSys.colorDead = new BABYLON.Color4(0, 0, 0.2, 1.0);
        PSys.noiseStrength = new BABYLON.Vector3(5, 1, 1);
        PSys.gravity =  new BABYLON.Vector3(0, -9.81, 0);
        PSys.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        PSys.targetStopDuration = 0.8;
        PSys.updateSpeed = PSys.updateSpeed * 2;
        PSys.disposeOnStop = true;
        PSys.onDisposeObservable.add(() => {
            delete Effects[id];
        });
        PSys.start();
    };

    const refresh_sprites = () => {
        // https://playground.babylonjs.com/#CUH660#3
        for (let i = RobotIDs.length - 1; i > - 1; i--) {
            let id = "" + RobotIDs[i],
                Robot = RobotMeshes[id];

            let Screen = Arena.CameraManager.toScreen(
                Robot.getBoundingInfo().boundingBox.centerWorld);

            let Sprite = Sprites[id]; // exist or ==false

            if (!Sprite) {
                // setup robot label
                let el = document.createElement("div");
                el.style.position = "absolute";
                el.style.backgroundColor = "transparent";
                el.style.opacity = 1;
                el.style.color = "white";
                // use Lookups to get robot name
                Entity = Lookups.get('Entities', id);
                el.innerText = Entity.eN;
                el.addEventListener("wheel", e => {
                    // dev: allows scroll wheel zoom
                    e.preventDefault();
                    Arena.Canvas.dispatchEvent(new WheelEvent(e.type, e));
                });
                // add to DOM
                Arena.Canvas.parentNode.append(el);
                Sprite = el;
                Sprites[id] = Sprite;
            }

            // label centering
            let elCX = Sprite.scrollWidth / 2,
                elCY = (Sprite.scrollHeight / 2);

            elCY -= 20;

            let elX = Screen.x + Arena.Canvas.offsetLeft - elCX,
                elY = Screen.y + Arena.Canvas.offsetTop - elCY;

            Sprite.style.left = elX + "px";
            Sprite.style.top = elY + "px";

            if (!Robot.__State.ac) {
                Sprite.style.color = "white";
                Sprite.style.opacity = 0.3;
            }
        }
        run_on_untracked(Sprites, RobotIDs, "remove");
    }

    const dispose_all = (Dict) => {
        let keys = Object.keys(Dict);
        for (i=keys.length-1; i>-1; i--) {
            Dict[keys[i]].dispose();
            delete Dict[keys[i]];
        }
    };

    const reset = () => {
        // dev: forces mesh recreation during replays
        //  e.g. bugfix for incorrect material due to mesh reuse
        RobotIDs = [];
        dispose_all(Gizmos);
        dispose_all(RobotMeshes);
        dispose_all(ScanMeshes);
    };

    load_single_mesh();

    Arena.Scene.onAfterRenderObservable.add(() => {
        refresh_sprites();
    });

    if (Settings.AddActionMesh) {
        Action.Mesh = asset_test_cube(
            "centerOfAction", {
                diffuseColor: new BABYLON.Color3(1,0,1),
            }
        );
    }

    return {
        Meshes: RobotMeshes,
        Action: Action,
        on: on,

        update: update,
        render: render,
        reset: reset,

        // interrupts
        explode: explode,
        shock: shock,
    }
}; // RobotSetup(...)
