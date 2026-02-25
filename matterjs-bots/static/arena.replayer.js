const createReplayer = (container, Events) => {
    let state = 'waiting',
        Player = false,
        dataset = [],
        playindex = 1,
        record_interval = 50,
        elPlayhead = false,
        elPlay = false,
        elPlayrate = false,
        elBack = false,
        elDownload = false,
        blobURL = false;

    if (typeof container == 'string') {
        container = document.querySelector(container);
        elPlayhead = container.querySelectorAll('.playhead');
        elPlay = container.querySelectorAll('.play');
        elPlayrate = container.querySelectorAll('.playrate');
        elBack = container.querySelectorAll('.seek');
        elDownload = container.querySelectorAll('.download');
    }

    if (elBack) elBack.forEach(el => {
        el.addEventListener('click', () => {
            seek(playindex + parseInt(el.dataset.records));
        });
    });

    if (elPlayrate) elPlayrate.forEach(el => {
        el.addEventListener('input', () => {
            rate(el.value);
        });
    });

    if (elPlayhead) elPlayhead.forEach(el => {
        el.addEventListener('input', () => {
            seek(el.value);
        });
    });

    if (elPlay) elPlay.forEach(el => {
        el.addEventListener('click', () => {
            if (state == 'playing') {
                pause();
            } else if (state == 'paused') {
                play();
            } else {
                console.log('[replay] unhandled state', state);
            }
        });
    });

    const load = (data) => {
        // reinitialise
        eject();
        dataset = data;

        // initialise arena
        if (Events && Events.oninit) Events.oninit(dataset);

        // set playhead range
        if (elPlayhead) elPlayhead.forEach(
            el => el.setAttribute('max', dataset.length - 1));

        document.body.classList.add('with-replay-controls');

        if (elDownload) {
            let blobData = new Blob([
                    JSON.stringify(dataset)], {
                    type: "application/json",
                });

            blobURL = URL.createObjectURL(blobData);

            elDownload.forEach(el => {
                el.href = blobURL;
                el.download = "data.json";
            });
        }

        state = 'paused';
    };

    const first_update_frame = () => {
        first = 0;
        while (dataset[first][2] != 'update' && first < dataset.length) {
            first ++;
        }
        return first;
    };

    const ensure_update_frame = () => {
        if (dataset[playindex][2] != 'update') {
            prev = playindex - 1;
            while(dataset[prev][2] != 'update' && prev > 0) {
                // seek last update, or 0
                prev--;
            }
            next = playindex + 1;
            while(dataset[next][2] != 'update' && next < dataset.length) {
                // seek next "update", or dataset length
                next++;
            }
            if (next < dataset.length) {
                // prioritise next available update frame...
                playindex = next;
                // console.log('[replayer] jump to next update', playindex);
                for (let i=prev+1; i<next; i++) {
                    // fire on<type> event if available
                    let ename = 'on' + dataset[i][2] + 'Data',
                        record = dataset[i][3];
                    if (Events && Events[ename]) {
                        Events[ename](record);
                    }
                }
            } else {
                // otherwise reset the playhead to the first frame
                playindex = first_update_frame();
            }
        }
    };

    const render = () => {
        if (playindex >= dataset.length) {
            if (Events && Events.oninit) Events.oninit(dataset);
            playindex = 1;
        }

        ensure_update_frame();

        record = dataset[playindex][3];

        // update playhead
        if (elPlayhead) elPlayhead.forEach(
            el => el.value = playindex);

        record.st.status = 'replay';

        // update arena state
        if (Events && Events.onupdate) Events.onupdate(record);

        playindex++;
    };

    const play = () => {
        pause();
        state = 'playing';
        Player = setInterval(render, record_interval);
    };

    const rate = (ms) => {
        record_interval = Math.min(Math.max(10, ms), 1000);
        console.log('[replayer] rate:', record_interval);
        if (state == 'playing') {
            // force rate to update
            play();
        };
    };

    const seek = (index) => {
        let previous = playindex;
        playindex = Math.min(Math.max(1, index), dataset.length)
        if (playindex < previous) {
            // backwards
            if (Events && Events.oninit) Events.oninit(dataset);
        }
        render();
    };

    const pause = () => {
        clearInterval(Player);
        state = 'paused';
    };

    const eject = () => {
        // stop any playback
        pause();

        // reinitialise
        dataset = [];

        // reset playhead
        playindex = 1;
        if (elPlayhead) elPlayhead.forEach(
            el => el.value = playindex);

        // reset playrate
        record_interval = 50;
        if (elPlayrate) elPlayrate.forEach(el => {
            el.value = record_interval;
        });

        // free up memory
        if (blobURL) URL.revokeObjectURL(blobURL);

        state = 'waiting';
    };

    const close = () => {
        eject();
        document.body.classList.remove('with-replay-controls');
    }

    eject();

    return {
        load: load,
        play: play,
        rate: rate,
        seek: seek,
        pause: pause,
        eject: eject,
        close: close,
    }
};
