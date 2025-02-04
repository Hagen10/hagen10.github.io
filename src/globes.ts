import * as versor from './versor.ts';
import * as helper from './helper.ts';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { Feature, GeoJsonProperties, MultiLineString, Point, Polygon } from 'geojson';
import * as solar from 'solar-calculator';

interface Topologies {
    basic: Feature<Point, GeoJsonProperties>,
    advanced: Feature<Point, GeoJsonProperties>
}

type Sun = [number, number];

enum Quality {
    Basic,
    Advanced
}

const secondsInADay: number = 86400000;
const graticule: MultiLineString = d3.geoGraticule10();
const sphere: d3.GeoSphere = { type: "Sphere" };

function create_sun(customDate: Date): Sun {
    // Converting the date to UTC.
    const customDateInUTC = new Date(customDate.toUTCString().slice(0, -4));
    const day = new Date(+customDateInUTC).setUTCHours(0, 0, 0, 0);
    const t = solar.century(customDateInUTC);
    const longitude: number = (day - customDateInUTC.getTime()) / secondsInADay * 360 - 180;
    return [longitude - solar.equationOfTime(t) / 4, solar.declination(t)];
}

function antipode([longitude, latitude]: Sun): Sun {
    return [longitude + 180, -latitude];
}

export class Globe {
    topologies: Topologies | null;
    solarTerminator: boolean;
    overlay: MultiLineString | null;
    container: HTMLElement;
    night: Polygon;
    twilight: Polygon;
    height: number = window.innerHeight;
    width: number = window.innerWidth;
    path: d3.GeoPath<any, d3.GeoPermissibleObjects> | null;
    context: CanvasRenderingContext2D | null;

    constructor(container: HTMLElement) {
        this.container = container;
        this.solarTerminator = true;
        this.topologies = null;
        this.overlay = null;
        this.path = null;
        this.context = null;

        var sun = create_sun(new Date);
        this.night = d3.geoCircle().radius(90).center(antipode(sun))();
        this.twilight = d3.geoCircle().radius(95).center(antipode(sun))();
    }

    setSun(date: Date) {
        const sun = create_sun(date);
        this.night = d3.geoCircle().radius(90).center(antipode(sun))();
        this.twilight = d3.geoCircle().radius(95).center(antipode(sun))();
    }

    setSolarTerminator(updatedSolarTerminator: boolean) {
        this.solarTerminator = updatedSolarTerminator;
        if (this.solarTerminator) this.setSun(new Date);
        this.render(Quality.Advanced);
    }

    render(quality: Quality, notMoving: boolean = true) {
        this.context!.clearRect(0, 0, this.width, this.height);
        this.context!.beginPath(), this.path!(sphere), this.context!.fillStyle = "#358af2", this.context!.fill();
        this.context!.beginPath(), this.path!(graticule), this.context!.strokeStyle = "#ccc", this.context!.stroke();

        switch (quality) {
            case Quality.Basic:
                this.context!.beginPath(), this.path!(this.topologies!.basic), this.context!.fillStyle = "#58c43d", this.context!.fill();
                break;
            case Quality.Advanced:
                this.context!.beginPath(), this.path!(this.topologies!.advanced), this.context!.fillStyle = "#58c43d", this.context!.fill();
                break;

            default: {
                break;
            }
        }

        if (notMoving)
            this.context!.beginPath(), this.path!(this.overlay!), this.context!.strokeStyle = "#656769", this.context!.stroke();

        // Night time
        if (this.solarTerminator) {
            this.context!.beginPath(), this.path!(this.night!), this.context!.fillStyle = "rgba(0,0,255,0.3)", this.context!.fill();
            this.context!.beginPath(), this.path!(this.twilight!), this.context!.fillStyle = "rgba(97, 97, 117, 0.3)", this.context!.fill();
        }

        this.context!.beginPath(), this.path!(sphere), this.context!.stroke();
    }
}

export function setupGlobe(globe: Globe) {
    const projection = d3.geoOrthographic().precision(0.1).fitSize([globe.width, globe.height], sphere);
    const context = helper.context2d(globe.width, globe.height);
    const path = d3.geoPath(projection, context);

    globe.context = context;
    globe.path = path;

    function zoom(projection: d3.GeoProjection) {
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

                globe.render(Quality.Basic, false);

                if (inertiaT > 1) {
                    console.log("STOPPING");
                    inertiaTimer.stop()
                    inertiaVelocity = [0, 0];
                    inertiaT = 1;

                    globe.render(Quality.Advanced);
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
        let land50str = "https://cdn.jsdelivr.net/npm/visionscarto-world-atlas@0.1.0/world/50m.json";
        let land110str = "https://cdn.jsdelivr.net/npm/visionscarto-world-atlas@0.1.0/world/110m.json";

        let response50: any = await d3.json(land50str)!;
        let response110: any = await d3.json(land110str)!;

        let land50: Feature<Point, GeoJsonProperties> = topojson.feature(response50, response50.objects.land);
        let land110: Feature<Point, GeoJsonProperties> = topojson.feature(response110, response110.objects.land);
        let borderMesh: MultiLineString = topojson.mesh(response50, response50.objects.countries, (a, b) => a !== b);

        globe.overlay = borderMesh;
        globe.topologies = { basic: land110, advanced: land50 };

        const zoomCall =
            // @ts-ignore
            zoom(projection)
                .on("zoom.render", () => globe.render(Quality.Basic, false))
                // @ts-ignore
                .on("end.render", () => globe.render(Quality.Advanced));

        globe.container.append(
            d3.select(context.canvas)
                .call(zoomCall)
                .call(() => globe.render(Quality.Advanced))
                .node()!
        );
    }

    generate_globe();
}