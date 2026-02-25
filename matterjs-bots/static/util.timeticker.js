if (!friendlyShortTime) throw Error('util.friendlyTimes.js not loaded');

setInterval(() => {
    let timetickers =document.querySelectorAll(".timeticker");
    for (var i=0; i<timetickers.length; i++) {
        let ticker = timetickers[i],
            dt = new Date(ticker.dataset.from).getTime(),
            now = new Date().getTime(),
            diff = Math.max(0, (now - dt)) / 1000,
            text = friendlyShortTime(diff);

        ticker.innerText = text;
    }
}, 1000);

const html_timeticker = (now) => {
    if (!now) {
        now = new Date();
    } else {
        now = new Date(now);
    }
    return ''
        + '<span '
            + 'class="timeticker" '
            + 'data-from="' + now + '">'
            + '0s'
        + '</span>';
};
