'use strict';

class CollapsiblePanel extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            open: !!props.open
        };

        this.self = React.createRef();
    }

    onToggle() {
        this.setState({
            open: !this.state.open
        });
    }

    onMinimise() {
        this.setState({
            open: false,
        });
    }

    onMaximise() {
        let me = this.self.current,
            siblings = me.parentNode.querySelectorAll('.CollapsiblePanel');
        siblings.forEach(el => {
            if (el == me) return;
            let minimise = el.querySelector('button.__minimise');
            minimise.click();
        });
        this.setState({
            open: true,
        });
    }

    render() {
        const e = React.createElement;

        var classNames = [
            "CollapsiblePanel",
            this.state.open ? 'maximised' : 'minimised',
        ];
        if (this.props.className) classNames.push(this.props.className);
        classNames = classNames.join(" ");

        return e("div", {
            className: classNames,
            ref: this.self,
        }, [
            e("div", {
                    key: "header",
                    className: "CollapsiblePanel__Header",
                },  [
                    this.props.children[0] || "none",
                    e('div', {
                        className: '__Toolbar',
                    }, [
                        e('button', {
                            className: '__minimise',
                            title: 'shrink to smallest size',
                            style: {'display': 'none'},
                            onClick: () => this.onMinimise(),
                        }, '_'),
                        e('button', {
                            className: '__toggle',
                            title: 'click to change size',
                            onClick: () => this.onToggle(),
                        }, [
                            e('span', { className: '__hide' }, '\u{25BC}'),
                            e('span', { className: '__show' }, '\u{25B2}'),
                        ]),
                        e('button', {
                            className: '__maximise',
                            title: 'expand full size',
                            onClick: () => this.onMaximise(),
                        }, '\u{29C8}'),
                    ]),
                ]
            ),
            e("div", {
                key: "content",
                className: "CollapsiblePanel__Body",
            }, e('div', {}, this.props.children.slice(1) || "none"))
        ])
    }
}; // CollapsiblePanel
