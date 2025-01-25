// Got from observablehq/stdlib - not sure why it doesn't working directly from the source.
export function context2d(width: number, height: number) {
    const dpi = devicePixelRatio;
    let canvas = document.createElement("canvas");
    canvas.width = width * dpi;
    canvas.height = height * dpi;
    canvas.style.width = width + "px";
    let context = canvas.getContext("2d")!;
    context.scale(dpi, dpi);
    return context;
}