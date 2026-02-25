const rgbGradient = (fadeFraction, rgbColor1, rgbColor2, rgbColor3, alpha) => {
    // 2/3 colour gradient for value 0.0 - 1.0
    // adapted from https://stackoverflow.com/a/61396704

    let color1 = rgbColor1,
        color2 = rgbColor2,
        fade = fadeFraction;

    if (typeof alpha === 'undefined') alpha = 1.0;

    if (rgbColor3) {
        fade = fade * 2;

        if (fade >= 1) {
            fade -= 1;
            color1 = rgbColor2;
            color2 = rgbColor3;
        }
    }

    let diffRed = color2.red - color1.red,
        diffGreen = color2.green - color1.green,
        diffBlue = color2.blue - color1.blue;

    var gradient = {
        red: parseInt(Math.floor(color1.red + (diffRed * fade)), 10),
        green: parseInt(Math.floor(color1.green + (diffGreen * fade)), 10),
        blue: parseInt(Math.floor(color1.blue + (diffBlue * fade)), 10)
    };

    return 'rgba(' +
        gradient.red + ',' +
        gradient.green + ',' +
        gradient.blue + ',' +
        alpha + ')';
};

// adapted from chatgpt answer, retrieved 2022-12-11
// answer has been restructured (if statement)
function rgbaGradient(colors, stops, position, As) {
    /* dev:
        * colors = [[r1,g1,b1,a1], [r2,g2,b2,a2], ...]
        * stops = [0, 0.25, ..., 1] */

    let r = g = b = a = false;

    // Handle the cases where the position is 0 or 1
    if (position <= 0) {
        [r,g,b,a] = colors[0];
    } else if (position >= 1) {
        [r,g,b,a] = colors[colors.length - 1];
    } else {
        // Find the two colors that the given position falls between
        let startIndex = 0,
            endIndex = 1;
        for (let i=0; i < stops.length-1; i++) {
            if (position >= stops[i]) {
                startIndex = i;
                endIndex = i + 1;
            }
        }

        // Calculate the RGBA values for the given position by interpolating
        // the values of the start and end colors

        const startRGBA = colors[startIndex];
        const endRGBA = colors[endIndex];
        const ratio = (position - stops[startIndex])
            / (stops[endIndex] - stops[startIndex]);

        r = startRGBA[0] + (endRGBA[0] - startRGBA[0]) * ratio;
        g = startRGBA[1] + (endRGBA[1] - startRGBA[1]) * ratio;
        b = startRGBA[2] + (endRGBA[2] - startRGBA[2]) * ratio;
        a = startRGBA[3] + (endRGBA[3] - startRGBA[3]) * ratio;
    }

    if (As == 'array') {
        return [r, g, b, a];
    } else if (As == 'ratios') {
        return [r/255, g/255, b/255, a];
    } else {
        // DEFAULT: Return the resulting color as an RGBA value
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
    }
}
