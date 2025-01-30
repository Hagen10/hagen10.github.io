import * as versor from './versor.ts';
import * as helper from './helper.ts';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { Feature, GeoJsonProperties, Point } from 'geojson';
import * as solar from 'solar-calculator';

// Code comes from: observablehq.com/@d3/versor-zooming and github.com/Fil/d3-inertia

interface Topologies {
    basic: Feature<Point, GeoJsonProperties>,
    advanced: Feature<Point, GeoJsonProperties>
}

type Sun = [number, number];

export function createGlobe(container: HTMLElement) {
    const graticule = d3.geoGraticule10();
    const sphere: d3.GeoSphere = { type: "Sphere" };
    const width = window.innerWidth;
    const height = window.innerHeight;
    const secondsInADay : number = 86400000;

    const projection = d3.geoOrthographic().precision(0.1).fitSize([width, height], sphere);
    const context = helper.context2d(width, height);
    const path = d3.geoPath(projection, context);

    function create_sun(customDate: Date) : Sun {
        const day = new Date(+customDate).setUTCHours(0, 0, 0, 0);
        const t = solar.century(customDate);
        const longitude : number = (day - customDate.getTime()) / secondsInADay * 360 - 180;
        return [longitude - solar.equationOfTime(t) / 4, solar.declination(t)];
    }

    function antipode([longitude, latitude] : Sun) : Sun {
        return [longitude + 180, -latitude];
    }

    const sun = create_sun(new Date);

    const night = d3.geoCircle().radius(90).center(antipode(sun))();

    function render(land: Feature<Point, GeoJsonProperties>) {
        context.clearRect(0, 0, width, height);
        context.beginPath(), path(sphere), context.fillStyle = "#358af2", context.fill();
        context.beginPath(), path(graticule), context.strokeStyle = "#ccc", context.stroke();

        // RED Graticule
        // context.beginPath(), path(graticule), context.strokeStyle = "#fc0f0f", context.stroke();

        context.beginPath(), path(land), context.fillStyle = "#58c43d", context.fill();
        // Night time
        context.beginPath(), path(night), context.fillStyle = "rgba(0,0,255,0.3", context.fill();

        context.beginPath(), path(sphere), context.stroke();
    }

    function zoom(projection: d3.GeoProjection, topologies: Topologies) {
        let scale = projection.scale();
        let v0: versor.triple, r0: versor.triple, v10: versor.triple, v11: versor.triple;
        let q0: versor.quad, q10: versor.quad;
        let a0: number, tl: number, inertiaTime: number = 0, inertiaT: number;
        let scaleExtent: [number, number] = [0.8 * scale, 30 * scale];
        let inertiaPosition: [number, number] = [0, 0];
        let inertiaVelocity: [number, number] = [0, 0];
        let inertiaTimer: d3.Timer = d3.timer(function () { });

        const A = 5000;
        const limit = 1.0001;
        const B = -Math.log(1 - 1 / limit);

        const zoom = d3.zoom()
            .scaleExtent(scaleExtent)
            .on("start", zoomStarted)
            .on("zoom", zoomed)
            .on("end", doneZooming);

        function point(this: any, event: any, that: any): [number, number, number] | [number, number] {
            const t = d3.pointers(event, that);

            if (t.length !== tl) {
                tl = t.length;
                if (tl > 1) a0 = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
                // @ts-ignore
                zoomStarted.call(that, event);
            }

            // For multitouch, average positions and compute rotation.
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

            inertiaPosition = [pt[0], pt[1]];
            inertiaVelocity = [0, 0];
            inertiaTimer.stop();
        }

        // For multitouch, compose with a rotation around the axis.
        function zoomed(this: any, event: any, d: any) {
            projection.scale(event.transform.k);
            const pt = point(event, this);

            var time = performance.now();
            var deltaTime = time - inertiaTime;
            var decay = 1 - Math.exp(-deltaTime / 1000);
            let [a, b] = inertiaVelocity.map(function (d, i) {
                var deltaPos = pt[i] - inertiaPosition[i];
                var deltaTime = time - inertiaTime;
                return 1000 * (1 - decay) * deltaPos / deltaTime + d * decay;
            });

            inertiaVelocity = [a, b];
            inertiaTime = time;
            inertiaPosition = [pt[0], pt[1]];

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
            // In vicinity of the antipode (unstable) of q0, restart.
            // @ts-ignore
            if (delta[0] < 0.7) zoomStarted.call(event, d);
        }

        function doneZooming(this: any, _event: any, _d: any) {
            var v = inertiaVelocity;

            if (v[0] * v[0] + v[1] * v[1] < 100) return inertiaTimer.stop();

            var time = performance.now();
            var deltaTime = time - inertiaTime;

            // 100 is replacing opt.hold whatever that is
            if (deltaTime >= 100) return inertiaTimer.stop();

            let [a, b] = inertiaPosition.map(function (d, i) {
                return d - inertiaVelocity[i] / 1000;
            });

            // @ts-ignore
            v10 = versor.cartesian(projection.invert([a, b]));
            q10 = versor.fromAngles(projection.rotate());
            // @ts-ignore
            v11 = versor.cartesian(projection.invert(inertiaPosition));

            console.log("STARTING TIMER");
            inertiaTimer.restart(function (e) {
                inertiaT = limit * (1 - Math.exp(-B * e / A));

                let delta2 = versor.delta(v10, v11, inertiaT * 1000);
                let angles = versor.toAngles(versor.multiply(q10, delta2));

                projection.rotate(angles);

                render(topologies.basic);

                if (inertiaT > 1) {
                    console.log("STOPPING");
                    inertiaTimer.stop()
                    inertiaVelocity = [0, 0];
                    inertiaT = 1;

                    render(topologies.advanced);
                }
            });
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

        let land50: Feature<Point, GeoJsonProperties> = topojson.feature(response50, response50.objects.land);
        let land110: Feature<Point, GeoJsonProperties> = topojson.feature(response110, response110.objects.land);

        const zoomCall =
            // @ts-ignore
            zoom(projection, { basic: land110, advanced: land50 })
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