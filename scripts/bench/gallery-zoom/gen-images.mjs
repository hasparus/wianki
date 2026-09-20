// 160 unique wedding-photo stand-ins: 1920px long edge, noisy gradients and
// shapes so JPEG decode cost resembles real photographs (~250-450 KB each).
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

await mkdir(new URL("./public/img/", import.meta.url), { recursive: true });
const rand = (seed) => {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
};
for (let i = 0; i < 160; i++) {
	const r = rand(i + 1);
	const landscape = i % 3 !== 0;
	const w = landscape ? 1920 : 1440,
		h = landscape ? 1440 : 1920;
	const shapes = Array.from({ length: 40 }, () => {
		const cx = r() * w,
			cy = r() * h,
			rad = 40 + r() * 400;
		const c = `hsl(${Math.floor(r() * 360)} ${40 + r() * 50}% ${30 + r() * 50}%)`;
		return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${c}" opacity="${0.4 + r() * 0.6}"/>`;
	}).join("");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${r() * 360} 60% 70%)"/><stop offset="1" stop-color="hsl(${r() * 360} 60% 30%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${shapes}</svg>`;
	const noise = Buffer.alloc(w * h);
	for (let p = 0; p < noise.length; p++) noise[p] = 118 + ((r() * 40) | 0);
	const buf = await sharp(Buffer.from(svg))
		.composite([
			{
				input: await sharp(noise, { raw: { width: w, height: h, channels: 1 } })
					.png()
					.toBuffer(),
				blend: "overlay",
			},
		])
		.jpeg({ quality: 82, mozjpeg: true })
		.toBuffer();
	await writeFile(new URL(`./public/img/${i}.jpg`, import.meta.url), buf);
	if (i % 40 === 0) console.log(i, w, h, buf.length);
}
console.log("done");
