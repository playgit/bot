(() => {
window.addEventListener('load', () => {

    let socket = window.__Arena.Socket,
        arenaAudio = window.__Arena.Audio,
        states_init = window.__Arena.states_init,
        states_update = window.__Arena.states_update;

    let container_tools = '#container-tools',
        container_replay = '#container-replay';

    /* make arena data available:
        * results as csv
        * most recent replays */

    // shared elements

    let container = document.querySelector(container_tools),
        eventSources = container.querySelector('select.event-sources'),
        switchSource = container.querySelector('.switch-source');

    // setup replayer

    const arenaReplayer = createReplayer(container_replay, {
        oninit: (dataset) => {
            // initialise arena with first record
            states_init(dataset[0][3]);
        },
        onupdate: (record) => states_update(record, { noShake: true }),
        oneventData: (record) => {
            if (record[0] == 'robot knockout') {
                window.__Renderer.explode_robot(record[1].id);
            } else if (record[0] == 'robot knockout') {
                window.__Renderer.shock_robot(record[1].id);
            }
        },
    });

    // support users uploading replayer json

    window.cache_user_json = false;
    createUploadJSONButton(container_tools + ' .upload-json', {
        onjson: (json) => {
            // expose the loaded json in window
            window.cache_user_json = json;

            // update dropdown

            let optionUserLoaded = eventSources.querySelector('.user-loaded'),
                // suffix with ts for change detection
                value = 'cache_user_json:' + (new Date).getTime();

            optionUserLoaded.classList.remove('dn');
            optionUserLoaded.setAttribute('value', value);
            eventSources.value = value;

            switchSource.dispatchEvent(new Event('click'));
        }
    });

    // event source switcher

    const switch_event_source = (() => {
        let previous = 'socket';

        return (src) => {
            if (src == previous) {
                console.log('[event source] no change');
                return;
            }
            previous = src;
            console.log('[event source] switching to:', src);

            arenaReplayer.close();
            // disconnect any sockets
            if (socket.connected) socket.disconnect();

            if (src == 'socket') {
                window.__REPLAY = false;
                window.IGNORE_FORCE_NEW_ONCE = true;
                socket.connect();

            } else if (src.startsWith('/')) {
                arenaAudio.mute();
                fetchTimeout(src, {
                    timeout: 10000,
                    method: 'GET',
                    mode: 'cors',
                    cache: 'no-cache',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                })
                .then(res => {
                    if (!res.ok) throw Error("Server returned " + res.status)
                    return res.json()
                })
                .then(data => {
                    window.__REPLAY = true;
                    arenaReplayer.load(data);
                    arenaReplayer.play();
                })
                .catch(err => {
                    console.log(err);
                });
            } else if (src.startsWith('cache_user_json')) {
                window.__REPLAY = true;
                arenaReplayer.load(window.cache_user_json);
                arenaReplayer.play();
            } else {
                console.log('[event source] unknown', src);
            }
        };
    })();

    switchSource.addEventListener('click', () => {
        switch_event_source(eventSources.value);
    });

    // update tool status

    let downloadCSVResults = container.querySelector(".download-csv-results"),
        fixedSources = eventSources.querySelectorAll('option.fixed'),
        lastFixedSource = fixedSources[fixedSources.length - 1];

    setInterval(() => {
        fetchTimeout('/check/data/' + window.arenaid, {
            timeout: 3000,
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json'
            },
        })
        .then(res => {
            if (!res.ok) throw Error("Server returned " + res.status)
            return res.json()
        })
        .then(data => {
            if (!data.response) throw Error("Invalid Response");

            if (data.response.results) {
                downloadCSVResults.classList.remove("dn");
            } else {
                downloadCSVResults.classList.add("dn");
            }

            if (data.response.recordings) {
                let Options = Object.fromEntries(
                        Array.from(
                            eventSources
                                .querySelectorAll('option.filesource')
                        )
                        .map(el => ([el.getAttribute('value'), el]))
                    );

                data.response.recordings.forEach(filename => {
                    let relpath = '/simlogs/' + filename;
                    if (relpath in Options) {
                        // prevent removal
                        delete Options[relpath];
                    } else {
                        let option = document.createElement('option'),
                            text_dt = toLocalText(
                                textToDate(filename.split('.')[2]));
                        option.value = relpath;
                        option.innerText = text_dt;
                        option.classList.add('filesource');
                        lastFixedSource.insertAdjacentElement(
                            'afterend', option);
                        // console.log('[replay] added:', text_dt)
                    }
                })

                // remove remaining options
                Object.values(Options).forEach(el => {
                    console.log('[replay] removed:', el.innerText);
                    el.remove()
                });
            }
        })
        .catch(err => {
            console.log('[/check/data]', err);
        });
    }, 3000);

}); // end window.load
})();
