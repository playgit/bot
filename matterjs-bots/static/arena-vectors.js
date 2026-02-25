let ArenaVectorBodies = (context, fontfamily, fontsize) => {
    fontfamily = fontfamily || "sans-serif";
    fontsize = fontsize || 12;

    let ctx = context,
        fontdefault = fontsize + "px " + fontfamily,
        cacheShape = {};

    const reproject = (x, y) => {
        // future: reprojection for more creative rendering of vectors
        return [x, y];
    }

    const draw_generic_vertexes = (body) => {
        ctx.beginPath();
        body.ed.forEach((e) => ctx.lineTo(...reproject(e.x, e.y)));
        ctx.closePath();
        ctx.strokeStyle = "#000"; // default
        // [F]ill[S]tyle
        ctx.fillStyle = "red";
        ctx.fill();
    };

    const client_robot_edges = (cX, cY, an) => {
        let edges = cacheShape['robot'],
            len_edges = edges.length,
            coordinates = Array(len_edges),
            cos = Math.cos(-an),
            sin = Math.sin(-an);

        for (let i=0; i<len_edges; i++) {
            let oX = edges[i].x,
                oY = edges[i].y;
            coordinates[i] = {
                x: (cos * oX) + (sin * oY) + cX,
                y: (cos * oY) - (sin * oX) + cY,
            };
        }
        return coordinates;
    }

    const draw_robot = (body) => {
        ctx.beginPath();
        client_robot_edges(body.ce[0], body.ce[1], body.an)
            .forEach((e) => ctx.lineTo(...reproject(e.x, e.y)));
        ctx.closePath();

        ctx.lineWidth = 3;
        // [ac]tive
        if (body.ac) {
            // [r]obot[h]ealth
            ctx.strokeStyle = rgbGradient(
                body.rh/100,
                {"red": 255, "green":   0, "blue": 0},
                {"red": 255, "green": 255, "blue": 0},
                {"red":   0, "green": 255, "blue": 0},
            );
        } else {
            ctx.strokeStyle = "transparent";
        }
        ctx.stroke();
        // ctx.fill();

        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = fontdefault;

        // [ac]tive
        if (body.ac) ctx.fillStyle = "white";
            else ctx.fillStyle = "red";

        ctx.fillText(
            // [e]ntity[N]ame
            body.eN || Lookups.get('Entities', body.id).eN,
            ...reproject(
                body.ce[0],
                body.ce[1] - body.mD));
    };

    const draw_sensor = (body) => {
        // 0 (tr), 3 = farthest edge; 1 (tl), 2 = closest edge

        let // find offsets from farthest edge center
            ox = (body.ed[0].x - body.ed[3].x) / 2,
            oy = (body.ed[0].y - body.ed[3].y) / 2,
            // calculate nearest edge point
            // shape is trapezoid, so imaginary rectangle tl edge
            x1 = (body.ed[1].x + body.ed[2].x) / 2 - ox,
            y1 = (body.ed[1].y + body.ed[2].y) / 2 - oy,
            // angle - rotated to be perpendicular
            ang = body.an + 1.5708;

        let len = body.sD,
            grad = ctx.createLinearGradient(
                x1, y1, x1 + Math.cos(ang) * len,
                        y1 + Math.sin(ang) * len);

        grad.addColorStop(0, "rgb(150,150,255,0)");
        grad.addColorStop(0.05, "rgb(150,150,255,0.15)");
        grad.addColorStop(0.8, "rgb(150,150,255,0.15)");
        grad.addColorStop(1, "rgba(150,150,255,0)");

        ctx.beginPath();
        body.ed.forEach(e => ctx.lineTo(...reproject(e.x, e.y)));
        ctx.fillStyle = grad
        ctx.closePath();
        ctx.fill();
    };

    const draw_projectiles = (body) => {
        ctx.beginPath();
        ctx.arc(
            ...reproject(body.ce[0], body.ce[1]),
            body.ra, 0, 2 * Math.PI, false);
        ctx.closePath();

        ctx.fillStyle = "#fff";
        ctx.fill();
    };

    return {
        set_edges: (id, edges) => {
            cacheShape[id] = edges;
            console.log('[vectors] edges:', id, cacheShape[id]);
        },
        draw: (robots, projectiles, sensors, walls) => {
            robots.forEach(robot =>  draw_robot(robot));
            projectiles.forEach(projectile => draw_projectiles(projectile));
            sensors.forEach(sensor => draw_sensor(sensor));
            if (walls) walls.forEach(wall => draw_generic_vertexes(wall));
        },
    };
}
