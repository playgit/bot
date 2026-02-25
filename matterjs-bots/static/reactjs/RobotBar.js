class RobotBar extends React.Component {
    e = React.createElement;

    constructor(props) {
        super(props);
        this.state = {
            robots: []
        }
        this.lookup = []; // track component instances
        this.refBar = false;
    }

    addRobot() {
        const e = React.createElement;

        this.setState(prevState => ({
            robots: [
                ...prevState.robots,
                e(RobotControlPanel, {
                    key: new Date().getTime(),
                    ref: (el) => this.lookup.push(el),
                    name: "R#" + this.state.robots.length,
                    presets: this.props.presets,
                    roboupload: this.props.roboupload,
                    minimised: true,
                    onTitleClick: (com) => this.handleRobotClick(com),
                    onRemoveClick: (com) => this.handleRobotRemove(com)
                })
            ]
        }));
    }

    handleRobotRemove(com) {
        var idx = this.lookup.indexOf(com),
            name = com.props.name;

        if (idx > -1) {
            this.setState(prevState => ({
                robots: prevState.robots.filter(r => r.props.name != name)
            }));
            this.lookup.splice(idx, 1);
        }

    }

    handleRobotClick(com) {
        // XXX: for whatever reason, splicing lookup during
        //  robot removal creates null entries in this.lookup
        this.lookup = this.lookup.filter(c => c);

        this.lookup
            .filter(c => c !== com) // exclude element which raised this
            .forEach(c => c.setState({minimised: true}));
    }

    /* detect and handle outside clicks */

    handleOutsideClick(e) {
        if (this.refBar && !this.refBar.contains(e.target)) {
            this.handleRobotClick(false);
        }
    }

    componentDidMount() {
        document.addEventListener('mousedown', this.handleOutsideClick.bind(this));
    }

    componentWillUnmount() {
        document.addEventListener('mousedown', this.handleOutsideClick.bind(this));
    }

    render() {
        const e = React.createElement;

        return e('div', {}, [
            e('button', {
                key: "add",
                className:"RobotBar__Plus",
                onClick: () => this.addRobot()
            }, "+"),
            e('span', {
                key: "collection",
                className:"RobotBar__Robot",
                ref: (el) => { this.refBar = el; },
            }, this.state.robots)
        ]);
    }
}
