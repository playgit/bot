const createTextareaList = (container, options) => {
    container = document.querySelector(container);

    var storage_key = container.dataset.key,
        textList = container.querySelector("textarea"),
        removeFirst = document.querySelector('.btn-remove-first'),
        removeLast = document.querySelector('.btn-remove-last'),
        Events = Object.assign({
            onvalidate: () => {},
            onstore : () => {},
        }, options.Events || {}),
        addItem = document.querySelectorAll(".add-list-item");

    const validate_list = (arr) => {
        return Events.onvalidate(arr);
    }

    const get_as_list = () => {
        let content = (textList.value || '').trim(),
            arr = [];

        content
            .replaceAll(',', '\n')
            .split('\n')
            .forEach(line => {
                if(line.trim()) arr.push(line.trim());
            });

        arr = validate_list(arr);

        textList.value = arr.join('\n');

        return arr;
    }

    const store = () => {
        let arr = get_as_list(),
            csv_list = arr.join(',');
        localStorage.setItem(storage_key, csv_list);
        Events.onstore(arr);
    };

    const add_item = (text) => {
        textList.value += '\n' + text + '\n';
        store();
    };

    const trim_list = (pos) => {
        let arr = get_as_list();

        if (pos == 'first') arr.shift();
            else if (pos == 'last') arr.pop();

        textList.value = arr.join('\n');
        store();
    }

    const replace_list = (list) => {
        list = list.join('\n');
        textList.value = list;
        store();
    }

    removeFirst.addEventListener('click', e => {
        trim_list('first');
    });

    removeLast.addEventListener('click', e => {
        trim_list('last');
    });

    addItem.forEach(e => {
        e.addEventListener('click', (e) => {
            add_item(e.target.dataset.id);
        });
    });

    textList.addEventListener('blur', () => {
        store();
    });

    var stored = localStorage.getItem(storage_key);
    if (!stored) stored = '';
    textList.value = stored;
    store();

    return {
        replace: replace_list,
    };
};
