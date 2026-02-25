const createUploadJSONButton = (element, Events) => {
    let elButton = document.querySelector(element),
        hiddenFileUploader = document.createElement('input');

    hiddenFileUploader.setAttribute('hidden', 'hidden');
    hiddenFileUploader.setAttribute('type', 'file');
    hiddenFileUploader.setAttribute('accepts', 'json');
    hiddenFileUploader.addEventListener('change', () => {
        let file = hiddenFileUploader.files[0];
        (async () => {
            const textContent = await file.text();
            let loaded_json = JSON.parse(textContent);
            if (Events && Events.onjson) {
                Events.onjson(loaded_json);
            }
        })();
    });

    document.body.appendChild(hiddenFileUploader);

    elButton.addEventListener('click', () => {
        hiddenFileUploader.click();
    });
};
