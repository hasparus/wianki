export type Impl = {
	setCols(cols: number, focalY: number): Promise<void>;
	/** Live-scale the grid over `frames` animation frames, then snap to the nearest level. */
	pinch(scale: number, frames: number, focalY: number): Promise<void>;
	scroller(): HTMLElement;
	loadedCount(): number;
	cols(): number;
};

declare global {
	interface Window {
		bench: {
			ready: Promise<void>;
			impl: Impl;
			scroll(pixelsPerSecond: number, ms: number): Promise<number[]>;
			zoomCycle(cols: number[]): Promise<number[]>;
			pinch(scale: number, frames: number): Promise<number[]>;
			loadedCount(): number;
			readonly glRenderer: string;
		};
	}
}

function recorder() {
	const stamps: number[] = [];
	let on = true;
	function tick(t: number) {
		stamps.push(t);
		if (on) requestAnimationFrame(tick);
	}
	requestAnimationFrame(tick);
	return {
		stop() {
			on = false;
			const deltas: number[] = [];
			for (let i = 1; i < stamps.length; i++)
				deltas.push(stamps[i] - stamps[i - 1]);
			return deltas;
		},
	};
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function installBench(
	impl: Impl,
	ready: Promise<void>,
	glRenderer: () => string,
) {
	window.bench = {
		ready,
		impl,
		get glRenderer() {
			return glRenderer();
		},
		loadedCount: () => impl.loadedCount(),
		async scroll(pps, ms) {
			const el = impl.scroller();
			const rec = recorder();
			const t0 = performance.now();
			await new Promise<void>((resolve) => {
				function step(now: number) {
					el.scrollTop = ((now - t0) / 1000) * pps;
					if (now - t0 < ms) requestAnimationFrame(step);
					else resolve();
				}
				requestAnimationFrame(step);
			});
			await wait(100);
			return rec.stop();
		},
		async zoomCycle(cols) {
			const rec = recorder();
			for (const c of cols) {
				await impl.setCols(c, window.innerHeight / 2);
				await wait(150);
			}
			return rec.stop();
		},
		async pinch(scale, frames) {
			const rec = recorder();
			await impl.pinch(scale, frames, window.innerHeight / 2);
			await wait(150);
			return rec.stop();
		},
	};
}
