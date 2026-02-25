const friendlyShortTime = (seconds) => {
    seconds = Math.max(0, seconds); // prevent -ve
    return (
        seconds > 86400 ? (seconds/86400).toFixed(2) + 'd' :
        seconds > 3600 ? (seconds/3600).toFixed(2) + 'h' :
        seconds > 60 ? (seconds/60).toFixed(1) + 'm' :
        Math.round(seconds) + 's');
};

const toLocalText = (dateObj, shortest) => {
    let datesep = '-',
        timesep = ':',
        whitespace = ' ';

    if (shortest) {
        datesep = '';
        timesep = '';
        whitespace = '';
    }

    return dateObj.getFullYear() + datesep +
        (("0" + (dateObj.getMonth()+1)).slice(-2)) + datesep +
        (("0" + (dateObj.getDate())).slice(-2)) + whitespace +
        (("0" + (dateObj.getHours())).slice(-2)) + timesep +
        (("0" + (dateObj.getMinutes())).slice(-2)) + timesep +
        (("0" + (dateObj.getSeconds())).slice(-2));
}

const textToDate = (raw) => {
    let YYYY = parseInt(raw.slice(0, 4)),
        MM = parseInt(raw.slice(4, 6)),
        DD = parseInt(raw.slice(6, 8)),
        HH = parseInt(raw.slice(8, 10)),
        mm = parseInt(raw.slice(10, 12)),
        ss = parseInt(raw.slice(12, 14));

    return new Date(YYYY, MM - 1, DD, HH, mm, ss);
}

if(typeof window === 'undefined') {
    // compat: nodejs
    module.exports = {
        friendlyShortTime: friendlyShortTime,
        toLocalText: toLocalText,
        textToDate: textToDate,
    };
}
