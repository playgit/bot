(() => {

    // ref: https://github.com/ericbutler555/plain-js-slidetoggle
    function _s(el, duration, callback, isDown) {

        if (typeof duration === 'undefined') duration = 400;
        if (typeof isDown === 'undefined') isDown = false;

        el.style.overflow = "hidden";
        if (isDown) el.style.display = "block";

        var elStyles        = window.getComputedStyle(el);

        var elHeight        = parseFloat(elStyles.getPropertyValue('height'));
        var elPaddingTop    = parseFloat(elStyles.getPropertyValue('padding-top'));
        var elPaddingBottom = parseFloat(elStyles.getPropertyValue('padding-bottom'));
        var elMarginTop     = parseFloat(elStyles.getPropertyValue('margin-top'));
        var elMarginBottom  = parseFloat(elStyles.getPropertyValue('margin-bottom'));

        var stepHeight        = elHeight        / duration;
        var stepPaddingTop    = elPaddingTop    / duration;
        var stepPaddingBottom = elPaddingBottom / duration;
        var stepMarginTop     = elMarginTop     / duration;
        var stepMarginBottom  = elMarginBottom  / duration;

        var start;

        function step(timestamp) {

            if (start === undefined) start = timestamp;

            var elapsed = timestamp - start;

            if (isDown) {
                el.style.height        = (stepHeight        * elapsed) + "px";
                el.style.paddingTop    = (stepPaddingTop    * elapsed) + "px";
                el.style.paddingBottom = (stepPaddingBottom * elapsed) + "px";
                el.style.marginTop     = (stepMarginTop     * elapsed) + "px";
                el.style.marginBottom  = (stepMarginBottom  * elapsed) + "px";
            } else {
                el.style.height        = elHeight        - (stepHeight        * elapsed) + "px";
                el.style.paddingTop    = elPaddingTop    - (stepPaddingTop    * elapsed) + "px";
                el.style.paddingBottom = elPaddingBottom - (stepPaddingBottom * elapsed) + "px";
                el.style.marginTop     = elMarginTop     - (stepMarginTop     * elapsed) + "px";
                el.style.marginBottom  = elMarginBottom  - (stepMarginBottom  * elapsed) + "px";
            }

            if (elapsed >= duration) {
                el.style.height        = "";
                el.style.paddingTop    = "";
                el.style.paddingBottom = "";
                el.style.marginTop     = "";
                el.style.marginBottom  = "";
                el.style.overflow      = "";
                if (!isDown) el.style.display = "none";
                if (typeof callback === 'function') callback(isDown);
            } else {
                window.requestAnimationFrame(step);
            }
        }

        window.requestAnimationFrame(step);
    };

    function down(el, duration, callback) {
        _s(el, duration, callback, true);
        return true;
    };

    function up(el, duration, callback) {
        _s(el, duration, callback);
        return false;
    };

    function toggle(el, duration, callback) {
        if (el.clientHeight === 0) {
            return down(el, duration, callback, true);
        } else {
            return up(el, duration, callback);
        }
    };

    window.__Slider = {
        toggle: toggle,
        down: down,
        up: up,
    }

    /*
    [.collapsible-group]
        (1)
        .collapsible-toggle [data-target=[with .collapsible-group] selector]
        .collapsible-content (ignored with .collapsible-group and data-target)
        (2)
        .collapsible-toggle
        .collapsible-content
    */

    window.addEventListener('load', () => {
        document.querySelectorAll('.collapsible-toggle').forEach(tEl => {
            tEl.addEventListener('click', () => {
                let parent = tEl.closest('.collapsible-group'),
                    target = (parent && tEl.dataset && tEl.dataset.target)
                        // option: auto-close for grouped content
                        ? parent.querySelector(tEl.dataset.target)
                        // default: within same scope as immediate parent
                        : tEl.parentNode.querySelector('.collapsible-content');
                // toggle target
                let opening = window.__Slider.toggle(
                    target, 300, (isOpen) => {
                        if (!isOpen) return;
                        window.scrollTo({
                            top: (parent || tEl).offsetTop,
                            behavior: 'smooth',
                        });
                    }
                );
                // when .collapsible-group defined
                if (parent && opening) {
                    // close others
                    parent.querySelectorAll('.collapsible-content')
                        .forEach(O => {
                            if (O.style.display !== 'none' && target != O) {
                                window.__Slider.up(O, 250);
                            }
                        }
                    );
                    // remove oepned state from tabs
                    parent.querySelectorAll('.collapsible-toggle')
                        .forEach(el => {
                            if (el != tEl) el.classList.remove('opened');
                        });
                };
                // change opened state on current
                if (opening) {
                    tEl.classList.add('opened');
                } else {
                    tEl.classList.remove('opened');
                }
            });
        });
    })

})();