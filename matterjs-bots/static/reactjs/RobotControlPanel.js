'use strict';

if (!doBrainCompile) throw Error('util.robotCompiler.js not loaded');

let list_context = [
    ['context', 'context (everything)'],
    ['context.state'],
    ['context.round'],
    ['context.state.scanner.wall'],
    ['context.state.scanner.robot'],
    ['context.state.scanner.projectile'],
    ['context.state.scanner.ALL'],
    ['context.state.proximity'],
    ['context.state.lastDamage'],
    ['context.memory'],
];

let list_insertion = [
    ['', 'insert...'],
    ['context.state.scanner.wall', 'context.state.scanner.wall[]'],
    ['context.state.scanner.robot', 'context.state.scanner.robot[]'],
    ['context.state.scanner.projectile', 'context.state.scanner.projectile[]'],
    ['context.state.scanner.ALL', 'context.state.scanner.ALL[]'],
    ['context.state.proximity', 'context.state.proximity[]'],
    ['context.action.desiredAngle', 'context.action.desiredAngle'],
    ['context.action.desiredForce', 'context.action.desiredForce'],
    ['context.action.desiredLaunch', 'context.action.desiredLaunch'],
    ['context.action.desiredScan', 'context.action.desiredScan'],
];

class RobotControlPanel extends React.Component {
    constructor(props) {
        super(props);

        // first non-blank brain preset
        var brainPreset = props.presets.findIndex(p => !!p[1]),
            brainCode = props.presets[brainPreset][1];

        this.state = {
            minimised: props.minimised || false,
            connected: false,
            status: "init",
            contextFull: "",
            contextFiltered: "",
            x: false,
            y: false,
            angle: false,
            scanner: false, // counts only
            proximity: false, // counts only
            brainPreset: brainPreset,
            brainCode: brainCode,
            brainStatus: "pending",
            msprocess: 0.0,
            opacity: 1.0,
        };

        this._isMounted = false;

        this.socket = false;
        this.timeout_status = false;

        this.runtimes = [];

        this.compileBrainFunction(brainCode, true);

        this.textarea_code = React.createRef();

        this.contextfilter = 'context';

        if (props.autoconnect) this.initSocket();
    }

    status_change(status, next) {
        this.setState({status: status});

        clearTimeout(this.timeout_status);
        if (next) this.timeout_status = setTimeout(() => {
            this.status_change(next.status || next);
        }, next.ms || 3000);
    }

    filterContext(textContext) {
        if (!textContext) return false;

        let _filtered = JSON.parse(textContext);

        // standardise to the same structure as seen by brain functions
        if (!('context' in _filtered)) _filtered = {'context': _filtered};

        let filterkeys = this.contextfilter.split('.'),
            len_filterkeys = filterkeys.length,
            undefined = false;

        for (let i=0; i<len_filterkeys; i++) {
            _filtered = _filtered[filterkeys[i]];
            if (typeof _filtered === 'undefined') {
                undefined = true;
                _filtered = '<filter did not complete at ' +  filterkeys[i] + '>'
                break;
            }
        }

        if (!undefined) {
            _filtered = JSON.stringify(_filtered, undefined, 2);
        }

        return _filtered;
    }

    initSocket() {
        var balancerid = window.balancerid || ""; // load-balancer

        this.socket = io({
            transports: ["websocket"],
            forceNew: true,
            query: {
                "iamarobot": true,
                "arenaid": window.location.pathname.split("/arena/").pop(),
                "balancerid": balancerid
            }
        });
        // socketman.js::connection(iamarobot)

        this.socket.on("connect", () => {
            this.status_change("connected", "connected, idle");
            this.setState({connected: true});
        });

        this.socket.on("disconnect", () => {
            if (this._isMounted) {
                // prevent memory leak when socket disconnected during unmount
                this.status_change("disconnected", "not connected");
                this.setState({connected: false});
            }
        });

        this.socket.on("cogitate", (context, cb) => {
            var start = (new Date()).getTime();

            this.status_change("thinking", "connected, idle");

            var _x, _y, _angle, _scanner, _proximity, _full;
            try {
                // prevent visual errors from invalid context
                _x = context.state.position.x.toFixed(2);
                _y = context.state.position.y.toFixed(2);
                _angle = context.state.angle.toFixed(3);
                _scanner = context.state.scanner.ALL.length;
                _proximity = context.state.proximity.length;
                _full = JSON.stringify(context);
            } catch(e) {
                _x = false,
                _y = false,
                _angle = false;
                _scanner = false;
                _full = false;
            }

            this.setState({
                x: _x,
                y: _y,
                angle: _angle,
                scanner: _scanner,
                proximity: _proximity,
                contextFull: _full,
                contextFiltered: this.filterContext(_full),
            });

            // run brain code
            // dev: only set if it compiles properly
            this.brain_function(context);

            delete context["state"]; // save bandwidth

            cb(context);

            this.runtimes.push((new Date()).getTime() - start);
            this.runtimes = this.runtimes.slice(-10);
            this.setState({
                "msprocess":
                    this.runtimes.reduce((a, b) => a + b, 0)
                        / this.runtimes.length
            });
        });
    }

    disposeSocket() {
        clearTimeout(this.timeout_status);
        this.socket.disconnect();
        this.timeout_status = false;
        this.socket = false;
    }

    compileBrainFunction(code, isinit) {
        let compilerResults = window.doBrainCompile(code);

        // only assign brain function if test completes
        if (compilerResults[0]) this.brain_function = compilerResults[0];

        if (isinit) {
            this.state.brainStatus = compilerResults[1];
        } else {
            this.setState({brainStatus: compilerResults[1]});
        }
    }

    handleSelectPreset(e) {
        var idx = e.target.value,
            code = this.props.presets[idx][1];

        this.compileBrainFunction(code);

        this.setState({
            brainPreset: idx,
            brainCode: code
        });
    }

    handleModifiedBrain(e) {
        var code = (e.target || e.current || e).value + "",
            idx = this.props.presets
                .findIndex(p => p[1] && p[1].trim() == code);

        if (idx <= 0) {
            // preset not found, use untrusted code
            idx = 0;
        } else {
            // preset found, use that code instead
            code = this.props.presets[idx][1];
        }

        this.compileBrainFunction(code);

        this.setState({
            brainPreset: idx,
            brainCode: code
        });
    }

    handleRemove(e) {
        e.preventDefault();
        e.stopPropagation();
        this.props.onRemoveClick(this);
    }

    componentDidMount() {
        this._isMounted = true;
    }

    componentWillUnmount() {
        this._isMounted = false;
        if (this.state.connected) this.disposeSocket();
    }

    toggleMinimised(e) {
        var minimised = !this.state.minimised;

        this.setState({
            minimised: minimised,
            opacity: 1.0,
        })
    }

    toggleConnect() {
        if (this.state.connected) {
            this.disposeSocket();
        } else {
            if (this.socket === false) {
                this.initSocket();
            } else {
                this.socket.connect();
            }
        }
    }

    doCopyContext() {
        navigator.clipboard.writeText(this.state.contextFiltered);
        console.log('[rcp] current context copied to clipboard');
    }

    doUploadCode() {
        if (confirm(
                'Your code will be uploaded. ' +
                'Any robot already on the server will be overwritten. ' +
                'Select "OK" to proceed.')) {

            let [robotid, robotkey] = this.props.roboupload;

            console.log(robotid);

            fetch('/robot/update?ret=json', {
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    robot: {
                        'id': robotid,
                        'key': robotkey,
                        'name': robotid,
                        'team': 'arena',
                        'brain': this.state.brainCode,
                    },
                }),
            })
            .then(res => {
                if (!res.ok) throw Error('Server returned ' + res.status)
                return res.json()
            })
            .then(data => {
                console.log('[doUploadCode] data', data);
                if (data.action) {
                    if (data.action[0]) {
                        alert(
                            data.action[1] + '. ' +
                            'Your robot can be accessed via the Robot ID ' +
                            'shown below the arena.');
                    } else {
                        alert(
                            'There was an issue uploading the robot. ' +
                            'Service returned: ' + data.action[1]);
                    }
                } else {
                    alert('The server did not return a valid response.');
                }
            })
            .catch(err => {
                alert('An error occurred. Details: ' + err);
                console.log('[doRetrieveCode] error', err);
            });
        } // confirm
    }

    doRetrieveCode() {
        let [robotid, _] = this.props.roboupload;

        fetch('/robot/fetch?ret=json', {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                robotid: robotid,
            }),
        })
        .then(res => {
            if (!res.ok) throw Error("Server returned " + res.status)
            return res.json()
        })
        .then(data => {
            if (data.brain) {
                console.log('[doRetrieveCode] data', data);
                if (confirm(
                        'Existing robot found on server. ' +
                        'Press "OK" to replace your current code ' +
                        'or "Cancel" and make a backup first.')) {

                    let code = data.brain || '';

                    this.compileBrainFunction(code);
                    this.setState({
                        brainCode: code,
                        brainPreset: 0,
                    });
                } else {
                    alert(
                        'Your current code is unchanged. ' +
                        'Please make a backup before loading a robot.');
                }
            } else {
                alert(
                    'No existing robot was found. ' +
                    'Your current code is unchanged.');
            }
        })
        .catch(err => {
            alert('An error occurred. Details: ' + err);
            console.log('[doRetrieveCode] error', err);
        });
    }

    doToggleOpacity() {
        let opacity = this.state.opacity;
        opacity += 0.5;
        if (opacity > 1.0) opacity = 0.5;
        this.setState({opacity: opacity});
    }

    insertAtSelection(textarea, text) {
        let el = textarea.current,
            len_existing = el.value.length,
            len_inserted = text.length,
            start = el.selectionStart,
            end = el.selectionEnd;

        el.value = el.value.substring(0, start) +
            text + el.value.substring(end, len_existing);

        el.setSelectionRange(start + len_inserted, start + len_inserted)
        el.focus();
    }

    doInsertCode(e) {
        e.stopPropagation();

        let target = e.target;

        if (!target.value) return;

        this.insertAtSelection(
            this.textarea_code,
            e.target.value);

        this.handleModifiedBrain(
            this.textarea_code);

        e.target.value = '';
    }

    setContextFilter(e) {
        let target = e.target;

        this.contextfilter = target.value;

        this.setState({
            contextFiltered: this.filterContext(this.state.contextFull),
        });
    }

    render() {
        const e = React.createElement;

        var classNames = ["RobotControlPanel"];
        if (this.state.minimised) classNames.push("minimised");
            else classNames.push("maximised");
        classNames = classNames.join(" ");

        // title content
        var titleContent = [
            e('span', {
                key: "title",
                title: 'click to toggle IDE',
                className: "RobotControlPanel__Title",
            }, [
                e('span', {
                    className: '__IconIDE',
                }, '\u{1F916}'),
                this.props.name,
            ])
        ];
        if (this.props.onRemoveClick) titleContent.push(
            e('span', {
                key: "remove",
                className: "RobotControlPanel__Remove",
                onClick: (e) => this.handleRemove(e)
            }, "X"));

        // control buttons

        var robotControls = [
            e('button', {
                key: "connection",
                onClick: () => this.toggleConnect()
            }, this.state.connected ? "disconnect" : "connect"),
        ];

        if (this.props.roboupload) robotControls.push(...[
            e('button', {
                key: "save-code",
                onClick: () => this.doUploadCode()
            }, "upload"),
            e('button', {
                key: "load-code",
                onClick: () => this.doRetrieveCode()
            }, "retrieve"),
        ]);

        robotControls.push(
            e('button', {
                key: "opacity",
                onClick: () => this.doToggleOpacity(),
            }, this.state.opacity == 1 ? 'see arena' : 'IDE only')
        );

        return e(ReactTransitionGroup.CSSTransition, {
                classNames: "Transition__RobotControlPanel__Robot",
                appear: true,
                in: true,
                timeout: 500,
            }, e('div', {
                    className: classNames,
                    style: {
                        'opacity': this.state.opacity
                    },
                }, [
                    e('div', {
                        key: "robot",
                        className: "RobotControlPanel__Robot"}, [
                        e('div', {
                            key: "name",
                            className: "RobotControlPanel__Robot__Name",
                            onClick: () => {
                                this.toggleMinimised();
                                if (this.props.onTitleClick)
                                    this.props.onTitleClick(this);
                            }
                        }, titleContent),
                        e('div', {
                            key: "status",
                            className: 'RobotControlPanel__Robot__State'}, [
                                e('span', {key:"status"}, "status"),
                                e('span', {},
                                    (this.state.status === false)
                                        ? "unknown"
                                        : this.state.status
                                ),
                            ]
                        ),
                        e('div', {
                            key: "angle",
                            className: 'RobotControlPanel__Robot__State'}, [
                                e('span', {key:"angle"}, "angle"),
                                e('span', {},
                                    (this.state.angle === false)
                                        ? "?"
                                        : this.state.angle
                                ),
                            ]
                        ),
                        e('div', {
                            key: "x",
                            className: 'RobotControlPanel__Robot__State'}, [
                                e('span', {key:"x"}, "x"),
                                e('span', {},
                                    (this.state.x === false)
                                        ? "?"
                                        :  this.state.x
                                ),
                            ]
                        ),
                        e('div', {
                            key: "y",
                            className: 'RobotControlPanel__Robot__State'}, [
                                e('span', {key:"y"}, "y"),
                                e('span', {},
                                    (this.state.y === false)
                                        ? "?"
                                        :  this.state.y
                                ),
                            ]
                        ),
                        // e('div', {
                        //     key: "y",
                        //     className: 'RobotControlPanel__Robot__State'}, [
                        //         e('span', {key:"scanner"}, "scanner"),
                        //         e('span', {},
                        //             (this.state.scanner === false)
                        //                 ? "?"
                        //                 :  this.state.scanner
                        //         ),
                        //     ]
                        // ),
                        // e('div', {
                        //     key: "y",
                        //     className: 'RobotControlPanel__Robot__State'}, [
                        //         e('span', {key:"proximity"}, "proximity"),
                        //         e('span', {},
                        //             (this.state.proximity === false)
                        //                 ? "?"
                        //                 :  this.state.proximity
                        //         ),
                        //     ]
                        // ),
                    ]),
                    e('div', {
                        key: "controls",
                        className: "RobotControlPanel__Controls"},
                        robotControls),
                    e(CollapsiblePanel, {
                        key: "context",
                        open:true,
                        className: "RobotControlPanel__Inputs"}, [
                            [
                                e('div', {key: "title"}, [
                                    'Inputs',
                                ]),
                                e('span', {key: "size"},
                                    this.state.contextFull.length + " bytes"),
                            ],
                            e('div', {
                                className: '__Toolbar',
                            }, [
                                e('select', {
                                        onClick: (e) => e.stopPropagation(),
                                        onChange: (e) => this.setContextFilter(e),
                                    },
                                    // preset variable list
                                    list_context.map(opt => e('option', {
                                            value: opt[0]
                                        },
                                        opt[1] || opt[0])
                                    )
                                ),
                                e('button', {
                                    key: 'copy-clipboard',
                                    title: 'copy context to clipboard',
                                    onClick: (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        this.doCopyContext();
                                    }
                                }, '\u{1F4CB}'),
                            ]),
                            e('textarea', {
                                autocomplete: 'false',
                                spellcheck: 'false',
                                value: this.state.contextFiltered ||
                                    '/* not connected ' +
                                        'or no inputs */',
                            }),
                        ]
                    ),
                    e(CollapsiblePanel, {
                        key: "brain",
                        open:true,
                        className: "RobotControlPanel__Brain"}, [
                            [
                                e('span', {},
                                    'Brain code'),
                                e('span', {}, [
                                    this.state.brainStatus + '; ',
                                    Math.ceil(this.state.msprocess) +
                                        "ms",
                                ]),
                            ],
                            e('div', {
                                    className: '__Toolbar',
                                }, e('select', {
                                        onClick: (e) => this.doInsertCode(e),
                                    },
                                    // preset variable list
                                    list_insertion.map(opt => e('option', {
                                            value: opt[0]
                                        },
                                        opt[1] || opt[0])
                                    )
                                )
                            ),
                            e('textarea', {
                                autocomplete: 'false',
                                spellcheck: 'false',
                                key: "code",
                                ref: this.textarea_code,
                                onChange: (e) => this.handleModifiedBrain(e),
                                value: this.state.brainCode || undefined
                            }),
                            e('div', {
                                key: "controls",
                                className: "RobotControlPanel__Brain__Controls"},
                                [
                                    e('select', {
                                        key: "presets",
                                        className: 'RobotControlPanel__Brain__Presets',
                                        value: this.state.brainPreset,
                                        onChange: (e) => this.handleSelectPreset(e)
                                    }, this.props.presets.map((p, idx) => e("option", {
                                        key: idx,
                                        value: idx
                                    }, p[0]))),
                                    e('span', {key:"WIP"}, "")
                                ]
                            )
                        ]
                    ),
                    e('div', {
                            className: "RobotControlPanel__StatusLine"
                        }, [
                            'controls \u{1F916} \u{2195} \u{1F5B5} shrink and expand panels; ',
                            'additional ',
                            e('a', {
                                'href': '/robot/samples',
                                'target': '_blank',
                            }, 'sample code'),
                            ' is available',
                        ]
                    ),
                ]
            )
        );
    }
} // RobotControlPanel
