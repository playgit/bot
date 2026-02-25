(() => {
window.addEventListener('load', () => {

if (!tagsafe) throw Error('util.tagsafe.js not loaded');
if (!Lookups) throw Error('util.lookups.js not loaded');

document.querySelectorAll(".toggle-display")
    .forEach(el => {
        el.addEventListener("click", function(){
            el.closest(".toggle-parent").classList.toggle("closed");

            setTimeout(() => {
                // dispatch for other handlers
                window.dispatchEvent(new Event('resize'));
            }, 150);
        });
    });

if (window.__Draggable) {
    window.__Draggable.ontap.push((e) => {
        let bubbled = e.target.closest('.close-sidebar-on-tap');
        if (!bubbled) return;
        if (!bubbled.dataset.closetarget) return;

        let target = document.querySelector(bubbled.dataset.closetarget);
        if (target.classList.contains('closed')) return;
        target
            .querySelector('.toggle-display')
            .dispatchEvent(new Event('click'));
    });
} else {
    console.log('window.__Draggable not available');
}

/* sidebar renderer */

const labelLastDamage = (r) => {
    let lastDamage = r.lD,
        text = 'no damage yet';

    if (lastDamage) {
        let Damage = Lookups.get('damage', lastDamage.dt),
            origin = getEntity(lastDamage.oI);

        text = Damage.label
            .replace('[oN]', origin.eN)
            .replace('[ol]', origin.el);
    }

    return text;
};

const getEntity = (id) => {
    return Lookups.get('Entities', id);
}

const render_sidebar = async (robots) => {
    let debug = robots.map(r =>
        '<div class="mv2 mh0 pr2 db">' +
            // robot name, team, health
            '<div class="ph2 pv1 mb1 white ' +
                // [ac]tive
                (r.ac
                    ? 'bg-robot-active'
                    : 'bg-robot-inactive') + ' ' +
                'db flex justify-between">' +
                '<div class="tl">' +
                    '<div class="f7 b mv1">' +
                        // [e]ntity[N]ame
                        tagsafe(getEntity(r.id).eN) +
                    '</div>' +
                    '<div>' +
                        '<small>' +
                            // [e]ntity[T]eam
                            tagsafe(getEntity(r.id).eT) +
                        '</small>' +
                    '</div>' +
                    // [l]ast[D]amage (log line)
                    '<div class="f7 b mv1">' +
                        '<small>' +
                            r.dc.toFixed(0) +
                        '</small> ' +
                        '<small class="' +
                        (r.lD
                            ? 'robot-damaged'
                            : 'robot-undamaged') + '">' +
                        labelLastDamage(r) +
                        '</small>' +
                    '</div>' +
                '</div>' +
                '<div class="flex flex-column items-center pv1">' +
                    '<div class="healthbar b--silver bg-black ' +
                        'flex items-end flex-grow-1">' +
                        '<div class="bar bg-green" ' +
                            'style="height:' +
                                // [r]obot[h]ealth
                                Math.ceil((Math.max(0, r.rh)))
                                + '%">' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            // [b]rain[S]tatus
            ((r.bS !== true) ?
            '<div class="f7 robot-fatal-error b tc">' +
                (
                    (typeof r.bS == 'object' &&
                            r.bS[0] &&
                            r.bS[1]) ?
                        ("(" + r.bS[0] + ") " +
                        r.bS[1])
                        : r.bS
                ) +
            '</div>' : ''
            ) +
        '</div>');
    document.getElementById("container-robots").innerHTML = debug.join("\n");
};

window.__Sidebar = {
    render: (() => {
        let alt = 0;
        const render = (robots) => {
            if (alt == 0) render_sidebar(robots);
            if ((alt++) > 5) alt = 0;
        };
        return render;
    })(),
};

}); // end window.load
})();
