(() => {
window.addEventListener('load', ()=>{

let Notification = document.querySelector('#notification'),
    Message = Notification.querySelector('.message'),
    Actions = Notification.querySelector('.actions'),
    baseCSS = Array.from(Notification.classList),
    Queue = [],
    counter = 0;

Actions.addEventListener('click', e => {
    if (e.target.dataset.hasOwnProperty('ack')) {
        dismiss(parseInt(e.target.dataset.ack))
    }
});

const show = (State) => {
    if (typeof State == 'string') State = { message: State };

    State = Object.assign({}, {
        id: counter,
        type: 'informational',
        message: 'No description',
        actions:
            '<button ' +
                'class="dismiss" ' +
                'data-ack="' + counter + '" ' +
                'title="dismiss..." ' +
            '>' +
                'X' +
            '</button>',
        css: 'notify-info',
    }, State);

    State.css = State.css.split(' ');

    Queue.push(State);

    counter++;

    latest();
};

const dismiss = (id) => {
    Queue = Queue.filter(N => N.id != id);
    latest();
}

const latest = () => {
    if (Queue.length <= 0) {
        document.body.classList.remove("with-notification");
        return false;
    }

    let count = Queue.length,
        State = Queue[count - 1];

    Notification.classList.remove(...Notification.classList);
    Notification.classList.add(...baseCSS);
    Notification.classList.add(...State.css);

    Message.innerHTML = State.message;
    Actions.innerHTML = State.actions;

    let Dismiss = Actions.querySelector('.dismiss');
    if (Dismiss) { Dismiss.innerText = count };

    document.body.classList.add("with-notification");
};

const clear = (byType) => {
    if (!byType) {
        Queue = [];
    } else if (typeof byType == 'string') {
        Queue = Queue.filter(N => N.type != byType);
    }

    console.log(byType, Queue);
    latest();
};

window.__Notifications = {
    show: show,
    hide: clear,
    clear: clear,
    debug_notification: () => {
        let css_class = ['notify-info', 'notify-success', 'notify-fail'][
            Math.floor(Math.random()*3)];
        show({
            type: 'debug',
            css: css_class,
            message: '<b>' + new Date() + '</b> ' +
            '<code>[' + css_class + ']</code> ' +
                'The quick brown frog jumped over the lazy dog. '.repeat(8)
        });
    },
};

}); // END window.load
})();
