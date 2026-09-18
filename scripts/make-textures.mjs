import sharp from "sharp";

/**
 * Run with `node scripts/make-textures.mjs` from the repo root.
 *
 * Two achromatic material surfaces for the tokonoma world, authored as exact
 * tiles. The field is a sum of sinusoids over a torus, so every frequency is a
 * whole number of cycles across the tile and the edges meet without a seam.
 */
function tile({ size, base, amplitude, octaves, seed }) {
	let state = seed;
	const rand = () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
	const waves = [];
	for (let o = 0; o < octaves; o += 1) {
		const freq = 2 ** (o + 2);
		for (let i = 0; i < 3; i += 1) {
			waves.push({
				kx: Math.round(freq * (0.5 + rand())),
				ky: Math.round(freq * (0.5 + rand())),
				px: rand() * Math.PI * 2,
				py: rand() * Math.PI * 2,
				gain: 1 / (o + 1),
			});
		}
	}
	const norm = waves.reduce((sum, w) => sum + w.gain, 0);
	const px = Buffer.alloc(size * size);
	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			let v = 0;
			for (const w of waves) {
				v +=
					w.gain *
					Math.sin((2 * Math.PI * w.kx * x) / size + w.px) *
					Math.sin((2 * Math.PI * w.ky * y) / size + w.py);
			}
			px[y * size + x] = Math.max(
				0,
				Math.min(255, Math.round(base + (v / norm) * amplitude)),
			);
		}
	}
	return sharp(px, { raw: { width: size, height: size, channels: 1 } });
}

// The alcove wall: a tooth you notice only once you look for it on #EFEFEF.
await tile({ size: 512, base: 239, amplitude: 3.5, octaves: 5, seed: 20260620 })
	.png({ compressionLevel: 9, colours: 64 })
	.toFile("public/textures/plaster.png");

// The suiban: the same tooth, slightly coarser, on #2A2A2A. Mottling reads
// louder against a dark ground than a light one, so it stays quiet here too.
await tile({ size: 512, base: 42, amplitude: 5.5, octaves: 4, seed: 19940317 })
	.png({ compressionLevel: 9, colours: 64 })
	.toFile("public/textures/bronze.png");

console.log("textures written");
