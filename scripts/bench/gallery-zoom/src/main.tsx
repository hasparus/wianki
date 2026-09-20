import { StrictMode, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { DomGrid } from "./dom-grid";
import { type Impl, installBench } from "./harness";
import type { Item } from "./layout";
import { R3fGrid } from "./r3f-grid";

const params = new URLSearchParams(location.search);
const impl = params.get("impl") ?? "dom";
const anim = (params.get("anim") ?? "raf") as "raf" | "css";
const n = Number(params.get("n") ?? 1500);
const levels = (params.get("levels") ?? "1,3,5,7").split(",").map(Number);
const initialCols = Number(
	params.get("cols") ?? levels[Math.floor(levels.length / 2)],
);
const texSize = Number(params.get("tex") ?? 0);

const items: Item[] = Array.from({ length: n }, (_, i) => {
	const img = i % 160;
	const landscape = img % 3 !== 0;
	return {
		id: i,
		src: `/img/${img}.jpg?i=${i}`,
		w: landscape ? 1920 : 1440,
		h: landscape ? 1440 : 1920,
	};
});

let resolveReady: () => void = () => {};
let resolveImpl: (impl: Impl) => void = () => {};
const implPromise = new Promise<Impl>((r) => (resolveImpl = r));
const readyPromise = new Promise<void>((r) => (resolveReady = r));
let glRenderer = "dom";

function App() {
	const onImpl = useCallback((i: Impl) => resolveImpl(i), []);
	const onLoad = useCallback(() => {}, []);
	const onRenderer = useCallback((name: string) => {
		glRenderer = name;
	}, []);
	const started = useRef(false);
	if (!started.current) {
		started.current = true;
		implPromise.then((i) => {
			// Ready once every tile of the initial viewport has decoded.
			const need = document.querySelectorAll(".tile").length || Infinity;
			const check = () => {
				const want = impl === "r3f" ? window.__initialTiles : need;
				if (i.loadedCount() >= want) resolveReady();
				else setTimeout(check, 50);
			};
			installBench(i, readyPromise, () => glRenderer);
			check();
		});
	}
	if (impl === "r3f") {
		return (
			<R3fGrid
				items={items}
				levels={levels}
				initialCols={initialCols}
				onImpl={onImpl}
				onLoad={onLoad}
				onRenderer={onRenderer}
				texSize={texSize}
			/>
		);
	}
	return (
		<DomGrid
			items={items}
			levels={levels}
			initialCols={initialCols}
			anim={anim}
			onImpl={onImpl}
			onLoad={onLoad}
		/>
	);
}

declare global {
	interface Window {
		__initialTiles: number;
	}
}

// The r3f grid has no DOM tiles to count; compute the initial visible count the same way.
import { computeLayout, visibleRange } from "./layout";

{
	const l = computeLayout(items, initialCols, window.innerWidth);
	const [a, b] = visibleRange(l, 0, window.innerHeight * 1.5);
	window.__initialTiles = b - a;
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
