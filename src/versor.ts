// Taken from Mike Bostock's Versor

const radians = Math.PI / 180;
const degrees = 180 / Math.PI;

type triple = [number, number, number];
type quad = [number, number, number, number];


export function cartesian(e: any): triple {
    const l = e[0] * radians, p = e[1] * radians, cp = Math.cos(p);
    return [cp * Math.cos(l), cp * Math.sin(l), Math.sin(p)];
}

export function delta(v0: triple, v1: triple): quad {
    const alpha = 1;

    function cross(v0: triple, v1: triple): triple {
        return [v0[1] * v1[2] - v0[2] * v1[1], v0[2] * v1[0] - v0[0] * v1[2], v0[0] * v1[1] - v0[1] * v1[0]];
    }

    function dot(v0: triple, v1: triple) {
        return v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2];
    }

    const w = cross(v0, v1);
    const l = Math.sqrt(dot(w, w));
    if (!l) return [1, 0, 0, 0];
    const t = alpha * Math.acos(Math.max(-1, Math.min(1, dot(v0, v1)))) / 2, s = Math.sin(t);
    return [Math.cos(t), w[2] / l * s, -w[1] / l * s, w[0] / l * s];
}

export function fromAngles([l, p, g]: triple) {
    l *= radians / 2;
    p *= radians / 2;
    g = (g || 0) * radians / 2;
    const sl = Math.sin(l), cl = Math.cos(l);
    const sp = Math.sin(p), cp = Math.cos(p);
    const sg = Math.sin(g), cg = Math.cos(g);
    return [
        cl * cp * cg + sl * sp * sg,
        sl * cp * cg - cl * sp * sg,
        cl * sp * cg + sl * cp * sg,
        cl * cp * sg - sl * sp * cg
    ];
}

export function multiply([a1, b1, c1, d1]: quad, [a2, b2, c2, d2]: quad) : quad {
    return [
        a1 * a2 - b1 * b2 - c1 * c2 - d1 * d2,
        a1 * b2 + b1 * a2 + c1 * d2 - d1 * c2,
        a1 * c2 - b1 * d2 + c1 * a2 + d1 * b2,
        a1 * d2 + b1 * c2 - c1 * b2 + d1 * a2
    ];
}

export function toAngles([a, b, c, d]: quad) : triple {
    return [
        Math.atan2(2 * (a * b + c * d), 1 - 2 * (b * b + c * c)) * degrees,
        Math.asin(Math.max(-1, Math.min(1, 2 * (a * c - d * b)))) * degrees,
        Math.atan2(2 * (a * d + b * c), 1 - 2 * (c * c + d * d)) * degrees
    ];
}