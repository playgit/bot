(() => {

if (!window.Howler) throw Error('howler.js not loaded');

window.Howler.autoSuspend = false;

const HowlerLoopSequencer = (() => {
    let loopid = -1;

    return (files, options) => {
        let Howlers = [],
            loadcount = 0,
            sequence = [],
            playing = false,
            currentAudio = false,
            settings= Object.assign({
                sequence: [],
                class: 'general',
            }, options);

        loopid++;

        const play = () => {
            let id = Math.floor(Math.random()*Howlers.length);
            // ensure each restart of the loop will use same sequence
            if (sequence.length > 0) id = sequence.shift();
            currentAudio = Howlers[id];
            currentAudio.play();
            playing = true;
            return loopid;
        };

        const stop = () => {
            sequence = [...settings.sequence];
            if (currentAudio) currentAudio.stop();
            playing = false;
        }

        const isPlaying = () => {
            return playing;
        }

        const loaded = () => {
            if (loadcount == Howlers.length) return true;
        }

        files.forEach(src => {
            let Audio = new Howl({
                src: src
            });
            Audio.on('end', () => { play(); });
            Audio.on('load', () => { loadcount++ });
            Howlers.push(Audio);
        })

        stop(); // resets sequence for next play

        return {
            _type: 'loopsequencer',
            _class: settings.class,
            isPlaying: isPlaying,
            play: play,
            stop: stop,
            loaded: loaded,
        }
    }
})();

const HowlerSting = (options) => {
    let Audio = new Howl(options);
    Audio._type = 'sting';
    Audio._class = options.class || 'general';
    return Audio;
}

window.AudioLibrary = {
    'blockbuster':
        HowlerSting({
            class: 'sfx',
            src: ['/audio/sfx/mixkit-epic-blockbuster-movie-transition-2907.wav']
        }),
    'whistlelong':
        HowlerSting({
            class: 'sfx',
            src: ['/audio/sfx/mixkit-police-short-whistle-615.wav']
        }),
    'whistleshort':
        HowlerSting({
            class: 'sfx',
            src: ['/audio/sfx/mixkit-police-whistle-614.wav']
        }),
    'battle end':
        HowlerSting({
            class: 'sfx',
            src: ['/audio/sfx/mixkit-orchestra-trumpets-ending-2292.wav']
        }),
    'robot launch':
        HowlerSting({
            class: 'sfx',
            rate: 2.0,
            volume: 0.5,
            src: ['/audio/sfx/mixkit-short-laser-gun-shot-1670.wav']
        }),
    'robot hit':
        HowlerSting({
            class: 'sfx',
            rate: 1.5,
            volume: 0.6,
            src: ['/audio/sfx/mixkit-electronic-retro-block-hit-2185.wav']
        }),
    'robot wall':
        HowlerSting({
            class: 'sfx',
            rate: 0.5,
            volume: 0.7,
            src: ['/audio/sfx/mixkit-quest-game-heavy-stomp-v-3049.wav']
        }),
    'robot robot':
        HowlerSting({
            class: 'sfx',
            rate: 1.0,
            volume: 0.3,
            src: ['/audio/sfx/mixkit-gearbox-working-2046.wav']
        }),
    'robot knockout' :
        HowlerSting({
            class: 'sfx',
            rate: 1.2,
            src: ['/audio/sfx/mixkit-8-bit-bomb-explosion-2811.wav']
        }),
    'robot shock' :
        HowlerSting({
            class: 'sfx',
            src: ['/audio/sfx/mixkit-electric-buzz-glitch-2594.wav']
        }),
    'battle loop' :
        HowlerLoopSequencer([
            '/audio/loops/uqm.battle1.wav',
            '/audio/loops/uqm.battle2.wav',
            '/audio/loops/uqm.battle3.wav',
            '/audio/loops/uqm.battle4.wav',
            '/audio/loops/uqm.battle5.wav',
            '/audio/loops/uqm.battle6.wav',
            '/audio/loops/uqm.battle7.wav',
        ], {
            class: 'music',
            sequence: [0],
        }),
};

})(); // end (preloader)

function createArenaAudio() {

    let AudioIsAvailable = 'unknown',
        toggles = {
            sfx: false,
            music: false,
        },
        DOM_toggles = [],
        Players = {},
        debounce_default = 100,
        debounce_special = {
            'robot launch': -1,
            'robot knockout': -1,
            'robot robot': 250,
        };

    const play = (label, once) => {
        // prevent audio being queued up when autoplay is blocked
        // https://github.com/goldfire/howler.js/issues/939#issuecomment-404710467
        if (!is_audio_available()) return;
        if (!AudioLibrary[label]) return;

        let curr = AudioLibrary[label],
            now = (new Date()).getTime(),
            id = false;

        if (!toggles[curr._class]) return;

        if (curr._type == 'sting') {
            // howler.js::Howl
            let sprites = curr._sprite;
            // cheap variable debounce
            if (label in Players) {
                if ((now - Players[label][1])
                    < (debounce_special[label] ||
                    debounce_default)
                ) return;
            }
            if (once) {
                // attach another event to fire after play ends
                curr.once('end', once);
            }
            if ('__default' in sprites) {
                id = curr.play();
                // console.log('audio sting', label);
            } else {
                let keys = Object.keys(sprites),
                    key = keys[Math.floor(Math.random() * keys.length)];
                id = curr.play(key);
                // console.log('audio sting, random', label);
            }
            Players[label] = [id, now, curr];
        } else if (curr._type == 'loopsequencer') {
            if (Players[label]) {
                // don't do anything
                console.log('audio already playing', label);
            } else {
                id = curr.play();
                Players[label] = [id, now, curr];
                console.log('audio loop', label);
            }
        }

        return id;
    }

    const stop = (label) => {
        if (!Players[label]) return;

        Players[label][2].stop();
        delete Players[label];
    };

    const stopAll = (cls) => {
        Object.keys(Players).forEach(label => {
            if (typeof label === 'undefined') {
                stop(label);
            } else if (Players[label][2]._class == cls) {
                stop(label);
            }
        });
    };

    const isPlaying = (label) => {
        if (!Players[label]) return;

        if (Players[label][2]._type == 'loopsequencer') {
            return Players[label][2].isPlaying();
        }
    };

    const toggle = (name, state) => {
        if (name in toggles) {
            let oldstate = toggles[name];
            if (typeof state == 'undefined') {
                toggles[name] = !toggles[name];
            } else {
                toggles[name] = !!state;
            }
            if (oldstate != toggles[name]) {
                console.log('audio toggle:',
                    name, toggles[name])
                // only when changes occur
                if (toggles[name] == false) {
                    stopAll(name);
                }
            }
            return toggles[name];
        }
    }

    const css_toggle = (el, state) => {
        if (state) {
            el.classList.add('state-on', 'bg-light-gray');
            el.classList.remove('state-off', 'bg-gray');
        } else {
            el.classList.add('state-off', 'bg-gray');
            el.classList.remove('state-on', 'bg-light-gray');
        }
    };

    const attach = (els) => {
        els.forEach(el => {
            let audioclass = el.dataset.audioclass || 'unknown';
            el.addEventListener('click', () => {
                css_toggle(el, toggle(audioclass));
            });
            DOM_toggles.push(el);
        });

        // force a check
        AudioIsAvailable = 'unknown';
        is_audio_available();
    };

    const set_audio_availability = (state) => {
        // global flag
        AudioIsAvailable = state;
        // body
        if (state) {
            document.body.classList.add('audio-enabled');
            document.body.classList.remove('audio-disabled');
        } else {
            document.body.classList.add('audio-disabled');
            document.body.classList.remove('audio-enabled');
        }
    }

    const mute_audio = () => {
        // per toggle element
        DOM_toggles.forEach(el => {
            // update buttons css
            css_toggle(el, false);
            // disable settings
            toggle(el.dataset.audioclass, false);
        });
    };

    const is_audio_available = () => {
        if (window.Howler.state == 'suspended') {
            // suspended
            if (AudioIsAvailable === 'unknown' ||
                    AudioIsAvailable === true) {
                set_audio_availability(false);
                mute_audio();
            } else {
                // already marked unavailable, do nothing
            }
            return false;
        } else {
            // probably available
            if (AudioIsAvailable === 'unknown' ||
                    AudioIsAvailable === false) {
                set_audio_availability(true);
                mute_audio();
            } else {
                // already marked available, do nothing
            }
            return true;
        }
    };

    const loaded = () => {
        let loaded = [],
            notloaded = [];
        Object.entries(AudioLibrary).forEach(entry => {
            let [label, obj] = entry;

            if (obj._type == 'loopsequencer') {
                if (obj.loaded) {
                    loaded.push(label);
                } else {
                    notloaded.push(label);
                }
            } else if (obj._type == 'sting') {
                if (obj.state() == 'loaded') {
                    loaded.push(label);
                } else {
                    notloaded.push(label);
                }
            } else {
                console.log('not recognised');
            }
        })

        console.log('[audio]',
            'loaded: ', loaded.length,
            'not loaded: ', notloaded);

        if (notloaded) return false;
        return true;
    };

    window.debug_audioplayers = Players;
    window.debug_audio_loaded = loaded;
    window.debug_audio_play = play;
    window.debug_force_play = () => AudioLibrary['blockbuster'].play();

    return {
        toggle: toggle,
        attach: attach,
        play: play,
        stop: stop,
        isPlaying: isPlaying,
        loaded: loaded,
        mute: mute_audio,
    }

}; // createArenaAudio()
