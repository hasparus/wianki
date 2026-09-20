import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { Impl } from "./harness";
import {
	anchorScroll,
	computeLayout,
	easeOut,
	type Item,
	type Layout,
	nearestLevel,
	type Rect,
	scaleRect,
	unionRange,
	visibleRange,
	ZOOM_MS,
} from "./layout";

type Props = {
	items: Item[];
	levels: number[];
	initialCols: number;
	anim: "raf" | "css";
	onImpl: (impl: Impl) => void;
	onLoad: () => void;
};

const BUFFER = 0.5; // viewports of overscan

const Tile = memo(function Tile({
	src,
	rect,
	onLoad,
	refCb,
}: {
	src: string;
	rect: Rect;
	onLoad: () => void;
	refCb: (el: HTMLDivElement | null) => void;
}) {
	return (
		<div
			className="tile"
			ref={refCb}
			style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
		>
			<img src={src} alt="" decoding="async" onLoad={onLoad} />
		</div>
	);
});

export function DomGrid({
	items,
	levels,
	initialCols,
	anim,
	onImpl,
	onLoad,
}: Props) {
	const width = window.innerWidth;
	const vh = window.innerHeight;
	const scrollerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const tileRefs = useRef(new Map<number, HTMLDivElement>());
	const [layout, setLayout] = useState<Layout>(() =>
		computeLayout(items, initialCols, width),
	);
	const [range, setRange] = useState<[number, number]>(() =>
		visibleRange(layout, 0, vh * (1 + BUFFER)),
	);
	const layoutRef = useRef(layout);
	layoutRef.current = layout;
	const animating = useRef(false);
	const pendingScroll = useRef<number | null>(null);

	const onScroll = useCallback(() => {
		if (animating.current) return;
		const top = scrollerRef.current!.scrollTop;
		const next = visibleRange(
			layoutRef.current,
			top - vh * BUFFER,
			top + vh * (1 + BUFFER),
		);
		setRange((cur) => (cur[0] === next[0] && cur[1] === next[1] ? cur : next));
	}, []);

	// Apply the scroll offset in the same commit as the new layout's height.
	useLayoutEffect(() => {
		if (pendingScroll.current !== null && scrollerRef.current) {
			scrollerRef.current.scrollTop = pendingScroll.current;
			pendingScroll.current = null;
		}
	});

	const runTransition = useCallback(
		(
			from: Layout,
			to: Layout,
			scrollFrom: number,
			scrollTo: number,
			live: { s: number; ox: number; oy: number } | null,
		) =>
			new Promise<void>((resolve) => {
				const ds = scrollTo - scrollFrom;
				const starts = new Map<number, Rect>();
				for (const [i, el] of tileRefs.current) {
					let r = from.rects[i];
					if (live) r = scaleRect(r, live.s, live.ox, live.oy);
					// Shift by the scroll change so the tile starts where it was on screen.
					starts.set(i, { x: r.x, y: r.y + ds, w: r.w, h: r.h });
					const t = to.rects[i];
					el.style.transition = "none";
					el.style.transform = `translate(${r.x - t.x}px, ${r.y + ds - t.y}px) scale(${r.w / t.w}, ${r.h / t.h})`;
					el.style.willChange = "transform";
				}
				const finish = () => {
					for (const el of tileRefs.current.values()) {
						el.style.transition = "";
						el.style.transform = "";
						el.style.willChange = "";
					}
					resolve();
				};
				if (anim === "css") {
					// FLIP: force the start frame to commit, then let the compositor run it.
					void contentRef.current!.offsetWidth;
					for (const el of tileRefs.current.values()) {
						el.style.transition = `transform ${ZOOM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
						el.style.transform = "translate(0px, 0px) scale(1, 1)";
					}
					setTimeout(finish, ZOOM_MS + 20);
					return;
				}
				const t0 = performance.now();
				const step = (now: number) => {
					const t = Math.min(1, (now - t0) / ZOOM_MS);
					const e = easeOut(t);
					for (const [i, el] of tileRefs.current) {
						const s = starts.get(i);
						const d = to.rects[i];
						if (!s) continue;
						const dx = (s.x - d.x) * (1 - e);
						const dy = (s.y - d.y) * (1 - e);
						const sx = 1 + (s.w / d.w - 1) * (1 - e);
						const sy = 1 + (s.h / d.h - 1) * (1 - e);
						el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
					}
					if (t < 1) requestAnimationFrame(step);
					else finish();
				};
				requestAnimationFrame(step);
			}),
		[anim],
	);

	const zoomTo = useCallback(
		async (
			cols: number,
			focalY: number,
			live: { s: number; ox: number; oy: number } | null,
		) => {
			const from = layoutRef.current;
			const scroller = scrollerRef.current!;
			const scrollFrom = scroller.scrollTop;
			const to = computeLayout(items, cols, width);
			const scrollTo = anchorScroll(from, to, scrollFrom, focalY);
			const rangeFrom = visibleRange(
				from,
				scrollFrom - vh * BUFFER,
				scrollFrom + vh * (1 + BUFFER),
			);
			const rangeTo = visibleRange(
				to,
				scrollTo - vh * BUFFER,
				scrollTo + vh * (1 + BUFFER),
			);
			animating.current = true;
			pendingScroll.current = scrollTo;
			if (contentRef.current) contentRef.current.style.transform = "";
			// Commit the target layout for the union of both visible sets.
			await new Promise<void>((r) => {
				setRange(unionRange(rangeFrom, rangeTo));
				setLayout(to);
				requestAnimationFrame(() => r());
			});
			await runTransition(from, to, scrollFrom, scrollTo, live);
			animating.current = false;
			setRange(rangeTo);
		},
		[items, runTransition],
	);

	const loaded = useRef(0);
	const impl = useMemo<Impl>(
		() => ({
			setCols: (cols, focalY) => zoomTo(cols, focalY, null),
			pinch: (scale, frames, focalY) =>
				new Promise<void>((resolve) => {
					const content = contentRef.current!;
					const scroller = scrollerRef.current!;
					const oy = scroller.scrollTop + focalY;
					const ox = width / 2;
					content.style.transformOrigin = `${ox}px ${oy}px`;
					content.style.willChange = "transform";
					let f = 0;
					const step = () => {
						f++;
						const s = 1 + (scale - 1) * Math.min(1, f / frames);
						content.style.transform = `scale(${s})`;
						if (f < frames) requestAnimationFrame(step);
						else {
							content.style.willChange = "";
							const target = nearestLevel(levels, layoutRef.current.cols / s);
							zoomTo(target, focalY, { s, ox, oy }).then(resolve);
						}
					};
					requestAnimationFrame(step);
				}),
			scroller: () => scrollerRef.current!,
			loadedCount: () => loaded.current,
			cols: () => layoutRef.current.cols,
		}),
		[zoomTo, levels],
	);
	useEffect(() => onImpl(impl), [impl, onImpl]);

	const refCbs = useRef(new Map<number, (el: HTMLDivElement | null) => void>());
	const refFor = (i: number) => {
		let cb = refCbs.current.get(i);
		if (!cb) {
			cb = (el) => {
				if (el) tileRefs.current.set(i, el);
				else tileRefs.current.delete(i);
			};
			refCbs.current.set(i, cb);
		}
		return cb;
	};
	const handleLoad = useCallback(() => {
		loaded.current++;
		onLoad();
	}, [onLoad]);
	const tiles = [];
	for (let i = range[0]; i < range[1]; i++) {
		tiles.push(
			<Tile
				key={items[i].id}
				src={items[i].src}
				rect={layout.rects[i]}
				onLoad={handleLoad}
				refCb={refFor(i)}
			/>,
		);
	}

	return (
		<div className="scroller" ref={scrollerRef} onScroll={onScroll}>
			<div
				className="content"
				ref={contentRef}
				style={{ height: layout.height }}
			>
				{tiles}
			</div>
		</div>
	);
}
