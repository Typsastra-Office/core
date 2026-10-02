// Load a built drawingfile.js + .wasm and inspect selection height, width and text.
// Usage: node selection_height_wasm_probe.cjs engine.js engine.wasm document.pdf
const fs = require("node:fs");
const vm = require("node:vm");

const [enginePath, wasmPath, pdfPath] = process.argv.slice(2);
if (!enginePath || !wasmPath || !pdfPath) throw new Error("Expected engine JS, wasm, PDF");
const wasm = fs.readFileSync(wasmPath);
let ready;
const loaded = new Promise((resolve) => { ready = resolve; });
const context = {
	console, WebAssembly, Uint8Array, Uint8ClampedArray, Int32Array,
	ArrayBuffer, DataView, TextDecoder, TextEncoder, Promise,
	setTimeout, clearTimeout, setInterval, clearInterval,
	navigator: { userAgent: "Chrome" },
	location: { protocol: "http:" },
	document: { currentScript: { src: "http://localhost/drawingfile.js" } },
	fetch: async () => new Response(wasm, { headers: { "Content-Type": "application/wasm" } }),
	AscViewer: { onLoadModule: () => ready() },
};
context.window = context;
context.self = context;
vm.runInNewContext(fs.readFileSync(enginePath, "utf8"), context, {
	filename: enginePath,
});

async function main() {
	await Promise.race([loaded, new Promise((_, reject) => setTimeout(() =>
		reject(new Error("PDF engine did not initialize")), 30000))]);
	const file = new context.AscViewer.CDrawingFile();
	const pdf = fs.readFileSync(pdfPath);
	const err = file.loadFromData(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));
	if (err) throw new Error("Failed to open PDF: " + err);
	const text = file.getGlyphs(0);
	if (!text) throw new Error("Native PDF text stream was not returned");
	const view = new DataView(text.buffer, text.byteOffset, text.byteLength);
	let pos = 0;
	const lines = [];
	const number = () => { const result = view.getInt32(pos, true) / 10000; pos += 4; return result; };
	const integer = () => { const result = view.getInt32(pos, true); pos += 4; return result; };
	while (pos < text.byteLength) {
		const x = number();
		const y = number();
		const rotated = view.getUint8(pos++);
		if (rotated) { number(); number(); }
		const ascent = number();
		const descent = number();
		const width = number();
		const count = integer();
		const glyphBytes = count * 8 + Math.max(0, count - 1) * 4;
		if (count < 0 || count > 100000 || pos + glyphBytes > text.byteLength)
			throw new Error("Invalid text stream line length");
		const codes = [];
		for (let i = 0; i < count; i++) {
			if (i) number();
			codes.push(integer());
			number();
		}
		lines.push({ x, y, ascent, descent, width, text: String.fromCodePoint(...codes) });
	}
	const line = lines.find((item) => item.text.replace(/\uFFFF/g, "")
		.includes("សទ្ទានុក្រមពាក្យច្បាប់"));
	console.log(JSON.stringify({ lines: lines.length, target: line, samples: lines.slice(0, 8)
		.map((item) => [item.text.slice(0, 36), item.x, item.y]), heights: lines.slice(0, 8)
		.map((item) => +(item.ascent + item.descent).toFixed(2)) }, null, 2));
	file.destroyTextInfo();
	file.close();
	if (!line) throw new Error("Target Khmer title absent from native text stream");
	if (line.ascent + line.descent > 40)
		throw new Error("Selection height remains larger than 40mm");
	if (Math.abs(line.width - 164.3) > 4)
		throw new Error("Selection width differs from the PDF's 465.8pt line width");
	if (line.text.includes("\uFFFF"))
		throw new Error("An artificial space was inserted inside the Khmer title");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
