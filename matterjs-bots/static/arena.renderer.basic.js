window.addEventListener('load', () => {

window.__Renderer = (() => {
    let canvas = document.querySelector("#arena"),
        ctx = canvas.getContext("2d"),
        arenaVectors = ArenaVectorBodies(ctx),
        arenaVisuals = createArenaVisuals(ctx),
        // other variables
        arenaDimensions = {
            width: -1,
            height: -1,
            wall: -1,
        },
        activeOverlay = false;

    const set_canvas = (width, height, wall) => {
        arenaDimensions.width = canvas.width = width;
        arenaDimensions.height = canvas.height = height;
        arenaDimensions.wall = wall;
        window.dispatchEvent(new Event('resize')); // for other handlers
        console.log('arena state set', width, height, wall);
    }

    const set_overlay = (image) => {
        activeOverlay = image;
    };

    const render_frame = (ro, pr, se, wa, arenaState, worldState, options) => {
        // robot states by id
        let robotById = {};
        for (let i = ro.length - 1; i>-1; i--) robotById[ro[i].id] = ro[i];
        ro.forEach(robot => { robotById[robot.id] = robot });

        // extra states from visual animations
        var extras = arenaVisuals.update(arenaState.co.fr, robotById);

        postrender = []; // dev: optional cleanup

        // is the simulation paused?
        let paused = arenaState.text_status == "paused" ? true : false;

        // start of rendering
        arenaVisuals.reset();

        // special: add canvas shake during explosions
        let noShake = (options || {}).noShake;
        if (
            extras && extras.explodingRobots.length > 0 &&
            !paused && !noShake
        ) {
            var _wall = arenaDimensions.wall,
                shake_x = Math.random() * _wall - (_wall/2),
                shake_y = Math.random() * _wall - (_wall/2);
            ctx.translate(shake_x, shake_y);
        }

        // arena floor
        arenaVisuals.background();

        if (activeOverlay) {
            // arena floor overlay (centered)
            ctx.drawImage(
                activeOverlay.Image,
                worldState.arena.width/2 - activeOverlay.Image.width/2,
                worldState.arena.height/2 - activeOverlay.Image.height/2);
        }

        arenaVisuals.hud(arenaState);

        // physics bodies
        arenaVectors.draw(ro, pr, se);

        // raster sprites
        arenaVisuals.render();

        arenaVisuals.results(arenaState);

        if (worldState.realtime) {
            // end of canvas rendering
            postrender.forEach(f => f());
        }
    }

    return {
        reset_visuals: arenaVisuals.reset,
        set_canvas: set_canvas,
        set_edges: arenaVectors.set_edges,

        render_frame: render_frame,

        explode_robot: arenaVisuals.explode_robot,
        shock_robot: arenaVisuals.shock_robot,

        set_overlay: set_overlay,
    }
})();

});
