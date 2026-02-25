// dancebot overlays
OverlayManager.setOverlays([
    {
        overlay: "/attract-mode/00-these-are.png",
        on: 0,
    },
    {
        // start: cluster
        overlay: "/attract-mode/01-these-are-robots.png",
        on: 50,
    },
    {
        // spread
        overlay: "/attract-mode/02-coded-in.png",
        rotation: Math.PI*3/2,
        on: 200,
    },
    {
        // far-side
        overlay: "/attract-mode/03-coded-in-js.png",
        rotation: Math.PI*3/2,
        on: 250,
    },
    {
        // far-side
        overlay: "/attract-mode/03b-js-and-websockets.png",
        rotation: Math.PI*3/2,
        on: 250,
    },
    {
        overlay: "/attract-mode/03c-autonomous.png",
        rotation: Math.PI*3/2,
        on: 450,
    },
    {
        // to center
        overlay: "/attract-mode/03d-autonomous-realtime.png",
        rotation: Math.PI*3/2,
        on: 600,
    },
    {
        // start circling
        overlay: "/attract-mode/05-circle-code.png",
        rotation: Math.PI,
        on: 800,
    },
    {
        // start circling
        overlay: "/attract-mode/06-circle-battle.png",
        rotation: Math.PI,
        on: 1133,
    },
    {
        // still circling
        overlay: "/attract-mode/07-circle-win.png",
        rotation: Math.PI,
        on: 1466,
    },
    {
        // THE END
        overlay: "/attract-mode/roboneo-code.png",
        rotation: Math.PI,
        on: 1800,
    },
    {
        // start crashing
        overlay: "BLANK",
        on: 2000,
    },
    {
        // start crashing
        overlay: "/artwork/square.ebotmasters-logo.png",
        on: 2070,
    },
]);
