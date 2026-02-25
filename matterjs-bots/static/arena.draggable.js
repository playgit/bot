(() => {
window.addEventListener('load', () => {

    // zoom limits
    var minZoom = 0.1,
        maxZoom = 4.0;

    var parent = document.querySelector('div#container-arena');

    var draggable = document.querySelector('canvas#arena');

    draggable.style.transformOrigin = "50% 50%";
    // affects: css transform zoom

    let dragging = false,
        touch = false,
        touch_and_move = false,
        scaling = false;

    // track the translation independently
    // don't need to do getComputedStyle() and matrix conversions
    var translateX = 0,
        translateY = 0;
        scale = 1.0;

    function getDragging(x, y) {
        return {
            // used for ui updates (css classes)
            fake: false,
            // parent: x, y
            x: x,
            y: y,
            // draggable: tranlateX, translateY
            translateX: translateX,
            translateY: translateY
        }
    }

    function dragStarted(atX, atY) {
        dragging = getDragging(atX, atY);
        dragTo(atX, atY);
    }

    function dragTo(atX, atY) {
        if (typeof atX == "undefined" && typeof atY == "undefined") {
            // no-op drag when no parameters, used for ui updates
            atX = 0;
            atY = 0;
            dragging = getDragging(0, 0);
            dragging.fake = true;
        }

        if (!dragging) return false;

        // helpers

        var actualWidth = draggable.clientWidth,
            actualHeight = draggable.clientHeight,
            parentWidth = parent.clientWidth,
            parentHeight = parent.clientHeight,
            scaledWidth = actualWidth * scale,
            scaledHeight = actualHeight * scale,
            // dev: offset from center, as calculations are
            //  based on top-left and/or center of draggable
            offsetCenterX = actualWidth / 2,
            offsetCenterY = actualHeight / 2,
            originCenterX = (parentWidth - actualWidth) / 2,
            originCenterY = (parentHeight - actualHeight) / 2;

        // calculate new translation using offset from origin
        translateX = dragging.translateX + (atX - dragging.x);
        translateY = dragging.translateY + (atY - dragging.y);

        parent.classList.remove("edge-top");
        parent.classList.remove("edge-bottom");
        parent.classList.remove("edge-left");
        parent.classList.remove("edge-right");

        // clamp translation to ensure content is always visible

        var oversizeX = scaledWidth - parentWidth;
        if (oversizeX <= 0) {
            // content fits into width, center
            translateX = parentWidth / 2;
            parent.classList.add("edge-left", "edge-right");
        } else {
            // width > container
            var centerX = translateX - offsetCenterX,
                horizontalOffset = (oversizeX / 2),
                lbound = originCenterX - horizontalOffset,
                rbound = originCenterX + horizontalOffset;

            if (centerX > rbound) {
                parent.classList.add('edge-left');
                translateX = rbound + offsetCenterX;
            }
            if (centerX < lbound) {
                parent.classList.add('edge-right');
                translateX = lbound + offsetCenterX;
            }
        }

        var oversizeY = scaledHeight - parentHeight;
        if (oversizeY <= 0) {
            // fits height, center, center
            translateY = parentHeight / 2;
            parent.classList.add("edge-bottom", "edge-top");
        } else {
            // height > container
            var centerY = translateY - offsetCenterY,
                verticalOffset = (oversizeY / 2),
                tbound = originCenterY - verticalOffset,
                bbound = originCenterY + verticalOffset;

            if (centerY < tbound) {
                parent.classList.add('edge-bottom');
                translateY = tbound + offsetCenterY;
            }
            if (centerY > bbound) {
                parent.classList.add('edge-top');
                translateY = bbound + offsetCenterY;
            }
        }

        transform();

        if (dragging.fake) dragging = false;
    }

    function transform() {
        // dev: translateX, translateY is calculated center,
        //  therefore apply adjustment for top-left translate
        draggable.style.transform = (
            "translateX(" + (translateX - draggable.clientWidth / 2) + "px)" +
            "translateY(" + (translateY - draggable.clientHeight / 2) + "px)" +
            "scale(" + scale + ")");
    }

    function reset() {
        var ratio_fit = Math.ceil(Math.max(
            draggable.clientWidth/(parent.clientWidth),
            draggable.clientHeight/(parent.clientHeight))*100)/100;
        scale = Math.max(minZoom, 1.0/ratio_fit);

        translateX = (parent.offsetWidth) / 2;
        translateY = (parent.offsetHeight) / 2;
        transform();
    }

    function handleDragStart(e) {
        if(e.type == 'touchstart') {
            let len_touches = e.touches.length;
            if (len_touches == 2) {
                scaling = [
                    scale,
                    Math.hypot(
                        e.touches[0].pageX - e.touches[1].pageX,
                        e.touches[0].pageY - e.touches[1].pageY)
                ];
                touch = false; // prevent tap from firing
            } else if (len_touches == 1) {
                touch = [e.touches[0].clientX, e.touches[0].clientY];
                dragStarted(...touch);
            }
        } else {
            dragStarted(e.clientX, e.clientY);
        }
        e.preventDefault();
    }

    function handleDragging(e) {
        if(e.type == 'touchmove') {
            let len_touches = e.touches.length;
            if (len_touches == 2) {
                let separation = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY);
                scale = separation / scaling[1] * scaling[0];
                dragTo();
            } else {
                let drag = [e.touches[0].clientX, e.touches[0].clientY];
                dragTo(...drag);
                if (touch[0] != drag[0] && touch[1] != drag[1]) {
                    touch_and_move = true;
                };
            }
        } else {
            // conventional drag with device
            dragTo(e.clientX, e.clientY);
        }
        e.preventDefault();
    }

    function handleDragEnd(e) {
        if(e.type == 'touchend') {
            if (touch && !touch_and_move) {
                // fire external events
                window.__Draggable.ontap.forEach(f => f(e));
            }
        }
        dragging = false;
        scaling = false;
        touch = false;
        touch_and_move = false;
        e.preventDefault();
    }

    function handleWheel(e) {
        e.preventDefault();

        // use linear scale adjustment per tick
        // dev: browser/version has varying deltaY implementation
        var fixed = 0.01;

        if (e.deltaY > 0) scale -= fixed;
        else if (e.deltaY < 0) scale += fixed;

        scale = Math.min(Math.max(minZoom, scale), maxZoom);
        dragTo();
    }

    function handleResize(e) {
        reset();
        dragTo();
    }

    parent.addEventListener('mousedown', handleDragStart);
    parent.addEventListener('mousemove', handleDragging);
    parent.addEventListener('mouseup', handleDragEnd);

    parent.addEventListener("touchstart", handleDragStart);
    parent.addEventListener("touchmove", handleDragging);
    parent.addEventListener("touchend", handleDragEnd);

    parent.addEventListener('mouseout', handleDragEnd);

    parent.addEventListener('wheel', handleWheel);

    window.addEventListener('resize', handleResize);

    handleResize();

    window.__Draggable = {
        ontap: [],
    };

}); // end: window.load
})();
