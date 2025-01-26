import * as versor from './versor.ts';
import * as helper from './helper.ts';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

// Code comes from: observablehq.com/@d3/versor-zooming

export function createGlobe(container: HTMLElement) {
    const graticule = d3.geoGraticule10();
    const sphere: d3.GeoSphere = { type: "Sphere" };
    const width = window.innerWidth * 0.9;
    const height2 = window.innerHeight * 0.9;
    // const height = get_height();

    const projection = d3.geoOrthographic().precision(0.1).fitSize([width, height2], sphere);
    const context = helper.context2d(width, height2);
    const path = d3.geoPath(projection, context);


    function get_height() {
        const [[x0, y0], [x1, y1]] = d3.geoPath(projection.fitWidth(width, sphere)).bounds(sphere);
        const dy = Math.ceil(y1 - y0), l = Math.min(Math.ceil(x1 - x0), dy);
        projection.scale(projection.scale() * (l - 1) / l).precision(0.2);

        projection.scale(200).precision(0.2);
        return window.innerHeight * 0.9;

        return dy;
    }

    function render(land: any) {
        context.clearRect(0, 0, width, height2);
        context.beginPath(), path(sphere), context.fillStyle = "#fff", context.fill();
        context.beginPath(), path(graticule), context.strokeStyle = "#ccc", context.stroke();

        // RED Graticule
        // context.beginPath(), path(graticule), context.strokeStyle = "#fc0f0f", context.stroke();

        context.beginPath(), path(land), context.fillStyle = "#000", context.fill();
        context.beginPath(), path(sphere), context.stroke();
    }

    function zoom(projection: d3.GeoProjection) {
        let scale = projection.scale();
        let v0: any, q0: any, r0: any, a0: any, tl: any;
        let scaleExtent: [number, number] = [0.8 * scale, 8 * scale];

        const zoom = d3.zoom()
            .scaleExtent(scaleExtent)
            .on("start", zoomStarted)
            .on("zoom", zoomed);

        function point(this: any, event: any, that: any): [number, number, number] | [number, number] {
            const t = d3.pointers(event, that);

            if (t.length !== tl) {
                tl = t.length;
                if (tl > 1) a0 = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
                // @ts-ignore
                zoomStarted.call(that, event);
            }

            return tl > 1 ? [
                d3.mean(t, p => p[0])!,
                d3.mean(t, p => p[1])!,
                Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0])
            ] : t[0];
        }

        function zoomStarted(this: any, event: any, _d: any) {
            let pt = point(event, this);
            // @ts-ignore
            v0 = versor.cartesian(projection.invert([pt[0], pt[1]]));
            q0 = versor.fromAngles(r0 = projection.rotate());
        }

        function zoomed(this: any, event: any, d: any) {
            projection.scale(event.transform.k);
            const pt = point(event, this);
            // @ts-ignore
            const v1 = versor.cartesian(projection.rotate(r0).invert([pt[0], pt[1]]));
            const delta = versor.delta(v0, v1);
            let q1 = versor.multiply(q0, delta);

            if (pt[2]) {
                const d = (pt[2] - a0) / 2;
                const s = -Math.sin(d);
                const c = Math.sign(Math.cos(d));
                q1 = versor.multiply([Math.sqrt(1 - s * s), 0, 0, c * s], q1);
            }

            projection.rotate(versor.toAngles(q1));

            console.log("Calling zoomStarted here");
            // @ts-ignore
            if (delta[0] < 0.7) zoomStarted.call(event, d);
        }

        return Object.assign((selection: any) =>
            selection.property('__zoom', d3.zoomIdentity.scale(projection.scale()))
                .call(zoom), {
            // @ts-ignore
            on(type: string, ...options) {
                return options.length
                    // @ts-ignore
                    ? (zoom.on(type, ...options), this)
                    : zoom.on(type);
            }
        }
        );
    }

    async function generate_globe() {
        let land50str = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json";
        let land110str = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json";

        let response50: any = await d3.json(land50str)!;
        let response110: any = await d3.json(land110str)!;

        let land50 = topojson.feature(response50, response50.objects.land);
        let land110 = topojson.feature(response110, response110.objects.land);

        const zoomCall =
            // @ts-ignore
            zoom(projection)
                .on("zoom.render", () => render(land110))
                // @ts-ignore
                .on("end.render", () => render(land50));

        container.append(
            d3.select(context.canvas)
                .call(zoomCall)
                .call(() => render(land50))
                .node()!
        );
    }

    generate_globe();
}