const addParallax = (container) => {
    let ruleindex = false;

    let classname = Array.from(container.classList)
        .filter(cn => cn.startsWith('bg-parallax-'));
    if (classname.length != 1) return;
    classname = classname[0];

    const parallax = () => {
        let elCen = 0,
            units = window.innerHeight/container.offsetHeight * 0.2;
            posY = (elCen + (window.scrollY * -units)),
            css_pos = 'center ' + posY + 'px';

        if (ruleindex === false) {
            ruleindex = document.styleSheets[0].insertRule(
                '.' + classname + ':before ' +
                '{ background-position: ' + css_pos + '; }');
        } else {
            document
                .styleSheets[0]
                .cssRules[ruleindex]
                .style.backgroundPosition = css_pos;
        }
    }

    window.addEventListener('scroll', parallax);
    window.addEventListener('resize', parallax);
    window.dispatchEvent(new Event('scroll'));
};

window.addEventListener('load', () => {
    document
        .querySelectorAll('.with-bg-parallax')
        .forEach(el => {
            addParallax(el);
        });
});