(() => {
window.addEventListener('load', () => {

let clickSelects = document.querySelectorAll('.click-select');
clickSelects.forEach(e => e.addEventListener(
    'click', (e) => {
        let tag = e.target.tagName;
        if (tag == 'PRE') {
            window
                .getSelection()
                .selectAllChildren(e.target);
        } else if (['TEXTAREA', 'INPUT'].includes(tag)) {
            e.target.select();
        }
    }));
}); // end window.load
})();
