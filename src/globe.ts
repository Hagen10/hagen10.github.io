import * as versor from './versor.ts';
import * as helper from './helper.ts';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

export function createGlobe(container: HTMLElement) {
    const graticule = d3.geoGraticule10();
    const sphere: d3.GeoSphere = { type: "Sphere" };
    const projection = d3.geoOrthographic().precision(0.1);
    const width = 928;
    const height = get_height();
    const context = helper.context2d(width, height);

    const path = d3.geoPath(projection, context);

    function get_height() {
        const [[x0, y0], [x1, y1]] = d3.geoPath(projection.fitWidth(width, sphere)).bounds(sphere);
        const dy = Math.ceil(y1 - y0), l = Math.min(Math.ceil(x1 - x0), dy);
        projection.scale(projection.scale() * (l - 1) / l).precision(0.2);
        return dy;
    }

    function render(land: any) {
        context.clearRect(0, 0, width, height);
        context.beginPath(), path(sphere), context.fillStyle = "#fff", context.fill();
        context.beginPath(), path(graticule), context.strokeStyle = "#ccc", context.stroke();

        // RED Graticule
        // context.beginPath(), path(graticule), context.strokeStyle = "#fc0f0f", context.stroke();

        context.beginPath(), path(land), context.fillStyle = "#000", context.fill();
        context.beginPath(), path(sphere), context.stroke();
    }

    function drag(projection: d3.GeoProjection) {
        let v0: any, q0: any, r0: any;

        function dragstarted(event: any, _d: any) {
            // @ts-ignore
            const res = projection.invert([event.x, event.y]);
            v0 = versor.cartesian(res);
            q0 = versor.fromAngles(r0 = projection.rotate());
        }

        function dragged(event: any, _d: any) {
            // @ts-ignore
            const res = projection.rotate(r0).invert([event.x, event.y]);
            const v1 = versor.cartesian(res);
            const q1 = versor.multiply(q0, versor.delta(v0, v1));
            projection.rotate(versor.toAngles(q1));
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged);
    }

    async function generate_globe() {
        let land50str = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json";
        let land110str = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json";

        let response50: any = await d3.json(land50str)!;
        let response110: any = await d3.json(land110str)!;

        let land50 = topojson.feature(response50, response50.objects.land);
        let land110 = topojson.feature(response110, response110.objects.land);

        const dragCall: d3.DragBehavior<any, any, any> = drag(projection)
            .on("drag.render", () => render(land110))
            .on("end.render", () => render(land50));

        container.append(
            d3.select(context.canvas)
                .call(dragCall)
                .call(() => render(land50))
                .node()!
        );
    }

    generate_globe();
}