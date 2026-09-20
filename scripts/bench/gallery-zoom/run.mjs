import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const PORT = 4173;
const RUNS = Number(process.env.RUNS ?? 3);
const N = Number(process.env.N ?? 1500);

const configs = [
	{
		name: "phone",
		viewport: { width: 390, height: 844 },
		dsf: 3,
		mobile: true,
		levels: "1,3,5,7",
		cols: 5,
		cycle: [3, 7, 1, 5],
		throttle: 1,
	},
	{
		name: "phone-4x",
		viewport: { width: 390, height: 844 },
		dsf: 3,
		mobile: true,
		levels: "1,3,5,7",
		cols: 5,
		cycle: [3, 7, 1, 5],
		throttle: 4,
	},
	{
		name: "desktop",
		viewport: { width: 1280, height: 800 },
		dsf: 2,
		mobile: false,
		levels: "2,4,6,9",
		cols: 6,
		cycle: [4, 9, 2, 6],
		throttle: 1,
	},
];
const impls = [
	{ name: "dom-css", query: "impl=dom&anim=css" },
	{ name: "dom-raf", query: "impl=dom&anim=raf" },
	{ name: "r3f-full", query: "impl=r3f" },
	{ name: "r3f-512", query: "impl=r3f&tex=512" },
];

function stats(deltas) {
	const s = [...deltas].sort((a, b) => a - b);
	const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
	const mean = s.reduce((a, b) => a + b, 0) / (s.length || 1);
	return {
		frames: s.length,
		mean: +mean.toFixed(1),
		p50: +q(0.5).toFixed(1),
		p95: +q(0.95).toFixed(1),
		max: +q(1).toFixed(1),
		over20: s.filter((d) => d > 20).length,
		over34: s.filter((d) => d > 34).length,
	};
}

function metricMap(m) {
	return Object.fromEntries(m.metrics.map((x) => [x.name, x.value]));
}
function delta(a, b) {
	return {
		task: +((b.TaskDuration - a.TaskDuration) * 1000).toFixed(0),
		script: +((b.ScriptDuration - a.ScriptDuration) * 1000).toFixed(0),
		layout: +((b.LayoutDuration - a.LayoutDuration) * 1000).toFixed(0),
		style: +((b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000).toFixed(0),
		heapMB: +(b.JSHeapUsedSize / 1048576).toFixed(1),
	};
}

function median(values) {
	const s = [...values].sort((a, b) => a - b);
	return s[Math.floor(s.length / 2)];
}

async function waitForServer() {
	for (let i = 0; i < 100; i++) {
		try {
			const r = await fetch(`http://localhost:${PORT}/`);
			if (r.ok) return;
		} catch {}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error("preview server did not start");
}

const server = spawn(
	"npx",
	["vite", "preview", "--port", String(PORT), "--strictPort"],
	{ cwd: new URL(".", import.meta.url).pathname, stdio: "ignore" },
);
await waitForServer();
const browser = await chromium.launch({
	headless: true,
	executablePath: process.env.CHROMIUM_PATH,
	args: [
		"--enable-precise-memory-info",
		"--ignore-gpu-blocklist",
		"--enable-unsafe-swiftshader",
	],
});

const results = [];
try {
	for (const cfg of configs) {
		for (const impl of impls) {
			const runs = [];
			for (let run = 0; run < RUNS; run++) {
				const context = await browser.newContext({
					viewport: cfg.viewport,
					deviceScaleFactor: cfg.dsf,
					isMobile: cfg.mobile,
					hasTouch: cfg.mobile,
				});
				const page = await context.newPage();
				const errors = [];
				page.on("pageerror", (e) => errors.push(String(e)));
				const cdp = await context.newCDPSession(page);
				await cdp.send("Performance.enable");
				if (cfg.throttle > 1)
					await cdp.send("Emulation.setCPUThrottlingRate", {
						rate: cfg.throttle,
					});
				const url = `http://localhost:${PORT}/?${impl.query}&n=${N}&levels=${cfg.levels}&cols=${cfg.cols}`;
				const t0 = Date.now();
				await page.goto(url);
				await page.waitForFunction(() => window.bench?.ready, null, {
					timeout: 90_000,
				});
				await page.evaluate(() => window.bench.ready);
				const readyMs = Date.now() - t0;
				const glRenderer = await page.evaluate(() => window.bench.glRenderer);
				const scenario = async (name, fn, arg) => {
					const before = metricMap(await cdp.send("Performance.getMetrics"));
					const deltas = await page.evaluate(fn, arg);
					const after = metricMap(await cdp.send("Performance.getMetrics"));
					return { name, ...stats(deltas), ...delta(before, after) };
				};
				const cycle = cfg.cycle;
				const out = {
					readyMs,
					glRenderer,
					scroll: await scenario("scroll", () =>
						window.bench.scroll(1200, 4000),
					),
					zoom: await scenario("zoom", (c) => window.bench.zoomCycle(c), cycle),
					pinchIn: await scenario("pinchIn", () => window.bench.pinch(1.6, 40)),
					pinchOut: await scenario("pinchOut", () =>
						window.bench.pinch(0.62, 40),
					),
					errors,
				};
				runs.push(out);
				console.log(
					`${cfg.name} ${impl.name} run${run}: ready ${readyMs}ms scroll p95 ${out.scroll.p95} zoom p95 ${out.zoom.p95} pinch p95 ${out.pinchIn.p95}/${out.pinchOut.p95} gl=${glRenderer} ${errors.length ? `ERRORS ${errors[0]}` : ""}`,
				);
				await context.close();
			}
			const med = (path) => median(runs.map((r) => path(r)));
			const agg = {
				config: cfg.name,
				impl: impl.name,
				glRenderer: runs[0].glRenderer,
				readyMs: med((r) => r.readyMs),
				errors: runs.flatMap((r) => r.errors),
			};
			for (const sc of ["scroll", "zoom", "pinchIn", "pinchOut"]) {
				agg[sc] = {};
				for (const k of [
					"frames",
					"mean",
					"p50",
					"p95",
					"max",
					"over20",
					"over34",
					"task",
					"script",
					"layout",
					"style",
					"heapMB",
				]) {
					agg[sc][k] = med((r) => r[sc][k]);
				}
			}
			results.push(agg);
		}
	}
} finally {
	await browser.close();
	server.kill();
}
await writeFile(
	new URL("./results.json", import.meta.url),
	JSON.stringify(results, null, 2),
);

let md = "";
for (const cfg of configs) {
	md += `\n### ${cfg.name} (${cfg.viewport.width}×${cfg.viewport.height} @${cfg.dsf}x${cfg.throttle > 1 ? `, CPU ${cfg.throttle}× slower` : ""})\n\n`;
	md +=
		"| impl | ready ms | scenario | frames | mean | p50 | p95 | max | >20ms | >34ms | main-thread ms | script ms | layout ms | style ms | heap MB |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n";
	for (const r of results.filter((x) => x.config === cfg.name)) {
		for (const sc of ["scroll", "zoom", "pinchIn", "pinchOut"]) {
			const s = r[sc];
			md += `| ${r.impl} | ${r.readyMs} | ${sc} | ${s.frames} | ${s.mean} | ${s.p50} | ${s.p95} | ${s.max} | ${s.over20} | ${s.over34} | ${s.task} | ${s.script} | ${s.layout} | ${s.style} | ${s.heapMB} |\n`;
		}
	}
}
await writeFile(new URL("./results.md", import.meta.url), md);
console.log(md);
