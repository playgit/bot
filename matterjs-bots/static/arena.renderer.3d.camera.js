const CameraSetup = (Arena, Options) => {
    let Settings = Object.assign({
        alpha: -Math.PI/2,
        beta: 0,
        radius: 150,
        target: BABYLON.Vector3.Zero(),
    }, Options || {});

    let Camera = new BABYLON.ArcRotateCamera(
            "StrategicCamera",
            Settings.alpha,
            Settings.beta,
            Settings.radius,
            Settings.target);

    Camera.allowUpsideDown = false;
    Camera.lowerBetaLimit = Math.min(0, Settings.beta);
    Camera.upperBetaLimit = Math.max(Math.PI/3, Settings.beta);
    Camera.lowerRadiusLimit = Math.min(10, Settings.radius);
    Camera.upperRadiusLimit = Math.max(200, Settings.beta);
    Camera.angularSensibility = 1;
    Camera.panningSensibility = 50;
    Camera.wheelPrecision = 1;

    Camera.setTarget(Settings.target);
    Camera.attachControl(Arena.Canvas, true);

    console.log("[3d.camera] started");

    let DEFAULT_FOV = Camera.fov;

    const toScreen = (Vertex) => {
        // https://playground.babylonjs.com/#DWPQ9R#240
        // worldspace to screenspace
        let Screen = new BABYLON.Vector3();
        BABYLON.Vector3.ProjectToRef(
            Vertex, BABYLON.Matrix.IdentityReadOnly,
            Arena.Scene.getTransformMatrix(),
            Arena.World.Viewport, Screen);
        return Screen;
    };

    const calculateFit = (worldwidth, worldheight) => {

        let VFOV = Camera.fov;

        if (worldheight > worldwidth) {
            // fit vertically
            let halfAngleV = Math.atan(worldheight/2/90);
            newFOV = halfAngleV * 2;
            newRadius = worldheight/2/Math.tan(VFOV/2);
        } else {
            // fit horizontally
            let halfAngleH = Math.atan(worldwidth/2/90);
            newFOV = Math.atan(Math.tan(halfAngleH)
                / Arena.World.aspectratio) * 2;
            // convert vertical fov to horizontal fov
            let HFOV = Math.atan(Math.tan(VFOV/2)
                * Arena.World.aspectratio) * 2;
            newRadius = worldwidth/2/Math.tan(HFOV/2);
        }

        return {
            fov: newFOV,
            radius: newRadius,
        };
    };

    const action = (Arena, Focus) => {
        // loe-priority if other animation is running
        if (Arena.Animator.isPlaying("Camera")) return;

        let radius = Arena.CameraManager
            .calculateFit(Focus.Dimensions[0], Focus.Dimensions[1])
            .radius;
        // +50%, limit [20, <Camera.upperRadiusLimit>]
        radius = Math.min(Math.max(
            20, radius * 1.5), Camera.upperRadiusLimit);

        Arena.Animator.Animate(
            "Camera", Camera, {
                target: Focus.Center,
                radius: radius,
            },
            Arena.World.framerate/5,
            Arena.World.framerate
        );

        // fov({frames: Arena.World.framerate/4}); // reset fov

        Arena.Animator.Animate(
            "CameraAlpha", Camera, {
                alpha: -Focus.rotation,
            },
            Arena.World.framerate * 2,
            Arena.World.framerate
        );
    };

    const topdown = (options) => {
        if (typeof options == "number") {
            // usage: stage(<last frame>)
            options = {
                "frames": options
            };
        };

        options = Object.assign({
            radius: Math.max(
                Arena.World.Dimensions[0],
                Arena.World.Dimensions[1]
            ) * 1.5,
            beta: 0,
            alpha: -Math.PI/2,
            frames: Arena.World.framerate,
        }, options || {});

        let vertical = Arena.Animator.Animate(
            "Camera", Camera, {
                "radius": options.radius,
                "beta": options.beta,
                "target": BABYLON.Vector3.Zero(),
            },
            options.frames,
            Arena.World.framerate
        );

        let horizontal = Arena.Animator.Animate(
            "CameraAlpha", Camera, {
                "alpha": options.alpha,
            },
            options.frames,
            Arena.World.framerate
        );

        // fov({frames: options.frames}); // reset fov

        if (vertical || horizontal) {
            console.log(
                "camera: topdown", options,
                horizontal, vertical);
        }
    };

    const stage = (options) => {
        if (typeof options == "number") {
            // usage: stage(<last frame>)
            options = {
                "frames": options
            };
        };

        options = Object.assign({
            radius: 140,
            beta: Math.PI / 3,
            alpha: -Math.PI * 3/4,
            frames: Arena.World.framerate,
        }, options || {});

        let vertical = Arena.Animator.Animate(
            "Camera", Camera, {
                "radius": options.radius,
                "beta": options.beta,
                "target": BABYLON.Vector3.Zero(),
            },
            options.frames,
            Arena.World.framerate
        );

        let horizontal = Arena.Animator.Animate(
            "CameraAlpha", Camera, {
                "alpha": options.alpha,
            },
            options.frames,
            Arena.World.framerate
        );

        // fov({frames: options.frames}); // reset fov

        if (vertical || horizontal) {
            console.log(
                "camera: center stage", options,
                horizontal, vertical);
        }
    }

    const single = (key, value, options) => {
        if (typeof options == "number") {
            // usage: stage(<last frame>)
            options = {
                "frames": options
            };
        };

        let Prop = {},
            Name = "Camera" + key.toUpperCase();

        if (Arena.Animator.isPlaying(Name)) return;

        Prop[key] = value;

        options = Object.assign({
            frames: Arena.World.framerate,
        }, options || {});

        let running = Arena.Animator.Animate(
            Name, Camera, Prop,
            options.frames, Arena.World.framerate);

        if (running) {
            console.log("camera.single: ", key, value, options);
        }
    };

    const fov = (options) => {
        if (typeof options == "number") {
            // usage: fov(<numeric fov>)
            options = {
                "fov": options
            };
        };

        options = Object.assign({
            fov: DEFAULT_FOV,
            frames: Arena.World.framerate/2,
        }, options || {});

        single("fov", options["fov"], options);
    };

    return {
        Camera: Camera,

        toScreen: toScreen,
        calculateFit: calculateFit,

        fov: fov,

        single: single,
        action: action,
        topdown: topdown,
        stage: stage,
    }
}; // CameraSetup(...)
