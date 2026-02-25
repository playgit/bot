(() => {
window.addEventListener('load', ()=> {

    const e = React.createElement;

    var presets = [
        [
            "(custom)",
            undefined
        ],
        [
            "Sample 1: nothing",
            "/* your javascript code here */"
        ],
        [
            "Sample 2: clockwise",
            "context.action.desiredAngle = context.state.angle + 0.05;"
        ],
        [
            "Sample 3: anticlockwise",
            "context.action.desiredAngle = context.state.angle - 0.05;"
        ],
        [
            "Sample 4: forward",
            "context.action.desiredForce = context.state.maxForce/10;"
        ],
        [
            'Sample 5: forward, wall avoidance with scanner',
            'context.action.desiredForce = context.state.maxForce/5;\n' +
            'if (context.state.scanner.wall.length > 0)\n' +
            '    context.action.desiredAngle = context.state.angleToCenter;'
        ],
        [
            'Sample 6: forward, wall avoidance with proximity',
            'context.action.desiredForce = context.state.maxForce/5;\n' +
            'let closest = context.state.proximity[0] || false;\n' +
            'if (closest.entityType == "wall")\n' +
            '    context.action.desiredAngle = context.state.angleToCenter;'
        ],
        [
            "Sample 7: fire",
            "context.action.desiredLaunch = true;"
        ],
        [
            "Sample 8: fire with scanner",
                "if (context.state.scanner.ALL.length > 0)\n"
              + "    context.action.desiredLaunch = true;"
        ],
        [
            "Sample 9: variable scan range",
                "if (context.action.desiredScan > 600)\n" +
                "    context.action.desiredScan = 50;\n" +
                "else\n" +
                "    context.action.desiredScan += 1;"
        ],
        [
            "Sample 10: memory example",
                "if (!('counter' in context.memory)) context.memory.counter = 0;\n" +
                "context.memory.counter++;"
        ]
    ];

    let Init = {
        presets: presets,
        roboupload: false,
    };

    if (window.__RobotUpload) Init.roboupload = window.__RobotUpload;

    var theRobotBar = ReactDOM.render(
        e(RobotBar, Init), document.querySelector("#robot-control-panel"));

    theRobotBar.addRobot();

}); // end: window.load
})();
