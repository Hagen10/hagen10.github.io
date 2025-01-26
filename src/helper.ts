// Got from observablehq/stdlib - not sure why it doesn't work directly from the source.
export function context2d(width: number, height: number) {
    const dpi = devicePixelRatio;
    let canvas = document.createElement("canvas");
    canvas.width = width * dpi;
    canvas.height = height * dpi;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    let context = canvas.getContext("2d")!;
    context.scale(dpi, dpi);
    return context;
}