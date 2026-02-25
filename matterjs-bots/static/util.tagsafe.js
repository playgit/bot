const tagsafe = (raw) => {
    // converts raw text into non-injectable form
    // safer for text output and tag attributes
    let safehtml = document.createElement('span');
    safehtml.textContent = raw;
    return safehtml.innerHTML
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
};
