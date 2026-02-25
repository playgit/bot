const createServerMonitor = (container, css) => {

    if (!friendlyShortTime) throw Error('util.friendlyTimes.js not loaded');

    let apikey = false,
        list_lb = document.querySelector(container),
        last_report = (new Date()).getTime();

    if (!css) css = {};

    if (!css.server) css.server = "f6 ph2 pv1 mb2 mr1";
    if (!css.error) css.error = "b red";
    if (!css.nodata) css.nodata = "b yellow";

    if (!css.secs_nominal) css.secs_nominal = "black bg-green";
    if (!css.secs_warning) css.secs_warning = "black bg-yellow";
    if (!css.secs_danger) css.secs_danger = "black bg-red";

    const setAPIKey = (key) => {
        apikey = key;
        console.log("[ui.serverMonitor.js] APIKey set", apikey.length, "chars");
    };

    let onData = (data, last_tracked) => {};
    let onError = (err, last_tracked) => {};

    const setOnData = (func) => onData = func;
    const setOnError = (func) => onData = func;

    const update = () => {
        let acquireData = false;

        if (apikey) {
            acquireData = (url) => {
                return fetchTimeout(url, {
                    method: 'POST',
                    mode: 'cors',
                    cache: 'no-cache',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 'api': apikey }),
                });
            };
        } else {
            acquireData = (url) => {
                return fetchTimeout(url, {
                    mode: 'cors',
                    cache: 'no-cache',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                });
            };
        }

        acquireData('/api/status')
            .then(res => res.json())
            .then(data => {
                let now = (new Date()).getTime(),
                    diff = Math.max(now - last_report, 0),
                    last_tracked = Math.round(diff/1000);

                onData(data, last_tracked);

                if (typeof data.Heartbeats != "object") {
                    list_lb.innerHTML = ''
                        + '<span class="' + css.nodata + '">'
                            + 'No Data '
                            + '(' + last_tracked + 's)'
                        + '</span>';

                    return false;
                }

                var html = '';
                for (const [listen, [utc, balancerid, ts_fork]]
                        of Object.entries(data.Heartbeats)) {

                    let now = (new Date()).getTime(),
                        start = (now - ts_fork)/1000,
                        report = Math.round(Math.max(
                            now - (new Date(utc)).getTime(),
                            0) / 1000),
                        css_report = (
                            report > 30 ? css.secs_danger :
                            report > 20 ? css.secs_warning :
                            css.secs_nominal
                        );

                    html += '' +
                        '<span ' +
                            'title="' +
                                'port: ' + listen + ', ' +
                                'runtime: ' +
                                    friendlyShortTime(start) +
                                '" ' +
                            'class="' +
                                css.server + ' ' +
                                css_report + '">' +
                            friendlyShortTime(report) + ' ' +
                            '<sup>' +
                                balancerid +
                            '</sup>' +
                        '</span>';
                }
                list_lb.innerHTML = html;

                last_report = (new Date()).getTime();
            })
            .catch(err => {
                let now = (new Date()).getTime(),
                    diff = Math.max(now - last_report, 0),
                    last_tracked = Math.round(diff/1000);

                onError(err, last_tracked);

                list_lb.innerHTML = ''
                    + '<span class="' + css.error + '">'
                        + 'Error: ' + err.message + ' '
                        + '(' + last_tracked + 's)'
                    + '</span>';
            });
    };

    list_lb.innerHTML = "loading...";
    setInterval(update, 1500);
    update();

    return {
        setAPIKey: setAPIKey,
        setOnData: setOnData,
        setOnError: setOnError,
    };
};
