import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	clampPinchScale,
	columnsAfterPinch,
	computeGridLayout,
	defaultColumns,
	focalPointIn,
	type GridLayout,
	nearestLevel,
	type Rect,
	scaleRect,
	unionRange,
	visibleRange,
	zoomLevels,
} from "@/components/gallery/grid-layout";
import type { GalleryItem } from "@/lib/domain";

export const ZOOM_MS = 450;
const ZOOM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Plates rendered beyond the viewport, in viewport heights, each way. */
const OVERSCAN = 0.5;
const STORAGE_KEY = "wianki.gallery.cols";

type LiveScale = { s: number; ox: number; oy: number };
type Flip = {
	fromById: Map<string, Rect>;
	scrollTo: number;
	scrollDelta: number;
	live: LiveScale | null;
};
type Registered = { element: HTMLElement; index: number };

/** The grid's top edge in document coordinates. Only valid while untransformed. */
function documentTop(element: HTMLElement) {
	return element.getBoundingClientRect().top + window.scrollY;
}

function documentLeft(element: HTMLElement) {
	return element.getBoundingClientRect().left + window.scrollX;
}

function readStoredColumns() {
	try {
		const value = Number(window.localStorage.getItem(STORAGE_KEY));
		return Number.isInteger(value) && value > 0 ? value : null;
	} catch {
		return null;
	}
}

function storeColumns(cols: number) {
	try {
		window.localStorage.setItem(STORAGE_KEY, String(cols));
	} catch {
		// A private window forgets the zoom; nothing else depends on it.
	}
}

function reducedMotion() {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The grid mechanics behind the gallery: a measured width, a zoom level, the
 * plates within a viewport of the scroll position, a FLIP transition between
 * levels that keeps the photograph under the fingers still, and the pinch and
 * trackpad gestures that drive it. The component only places what this says.
 */
export function useZoomableGrid({
	items,
	hasMore,
	pending,
	onLoadMore,
}: {
	items: GalleryItem[];
	hasMore: boolean;
	pending: boolean;
	onLoadMore: () => void;
}) {
	const containerRef = useRef<HTMLUListElement>(null);
	const tiles = useRef(new Map<string, Registered>());
	const [width, setWidth] = useState(0);
	const [cols, setCols] = useState<number | null>(null);
	const [range, setRange] = useState<[number, number]>([0, 0]);
	const flip = useRef<Flip | null>(null);
	const flipTimer = useRef(0);
	const animating = useRef(false);
	/** A pinch in progress scales the container, so its rect cannot be trusted. */
	const gesturing = useRef(false);
	const measured = width > 0;

	const levels = useMemo(() => zoomLevels(width || 390), [width]);
	const activeCols = cols ?? defaultColumns(width || 390);
	const layout = useMemo(
		() => computeGridLayout(items, activeCols, width || 390),
		[items, activeCols, width],
	);
	const layoutRef = useRef(layout);
	layoutRef.current = layout;
	const itemsRef = useRef(items);
	itemsRef.current = items;

	const rangeAt = useCallback((target: GridLayout, scrollY: number) => {
		const container = containerRef.current;
		if (!container) return [0, 0] as [number, number];
		const top = scrollY - documentTop(container);
		const vh = window.innerHeight;
		return visibleRange(target, top - vh * OVERSCAN, top + vh * (1 + OVERSCAN));
	}, []);

	const syncRange = useCallback(() => {
		if (animating.current || gesturing.current) return;
		const next = rangeAt(layoutRef.current, window.scrollY);
		setRange((current) =>
			current[0] === next[0] && current[1] === next[1] ? current : next,
		);
	}, [rangeAt]);

	// Measure once the list exists and again whenever its box changes. The
	// list mounts late when the first photos arrive by poll, hence the dep.
	const hasItems = items.length > 0;
	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container || !hasItems) return;
		const measure = () => {
			const next = container.clientWidth;
			if (!next) return;
			setWidth(next);
			setCols((current) => {
				const stops = zoomLevels(next);
				const wanted = current ?? readStoredColumns() ?? defaultColumns(next);
				return nearestLevel(stops, wanted);
			});
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(container);
		return () => observer.disconnect();
	}, [hasItems]);

	// The plates in view follow the scroll position...
	useEffect(() => {
		if (!measured) return;
		window.addEventListener("scroll", syncRange, { passive: true });
		window.addEventListener("resize", syncRange);
		return () => {
			window.removeEventListener("scroll", syncRange);
			window.removeEventListener("resize", syncRange);
		};
	}, [measured, syncRange]);

	// ...and the layout, which grows as pages arrive. A zoom in flight keeps
	// its union of plates until the transition ends.
	useEffect(() => {
		if (!measured || animating.current) return;
		const next = rangeAt(layout, window.scrollY);
		setRange((current) =>
			current[0] === next[0] && current[1] === next[1] ? current : next,
		);
	}, [measured, layout, rangeAt]);

	// Continuous loading: ask for the next page before the last row shows.
	useEffect(() => {
		if (!measured || !hasMore || pending) return;
		if (range[1] >= items.length - layout.cols * 2) onLoadMore();
	}, [
		measured,
		hasMore,
		pending,
		range,
		items.length,
		layout.cols,
		onLoadMore,
	]);

	const zoomTo = useCallback(
		(
			target: number,
			focalClientX: number,
			focalClientY: number,
			live: LiveScale | null,
		) => {
			const container = containerRef.current;
			if (!container || animating.current || target === layoutRef.current.cols)
				return;
			const from = layoutRef.current;
			const current = itemsRef.current;
			// Drop any live pinch scale before measuring; nothing paints in between.
			container.style.transform = "";
			container.style.willChange = "";
			gesturing.current = false;
			const top = documentTop(container);
			const scrollY = window.scrollY;
			const fx = live ? live.ox : focalClientX - documentLeft(container);
			const fy = live ? live.oy : scrollY + focalClientY - top;
			const to = computeGridLayout(current, target, width);
			const nextScrollY = Math.max(
				0,
				top + focalPointIn(from, to, fx, fy) - focalClientY,
			);
			const rangeFrom = rangeAt(from, scrollY);
			const union = unionRange(rangeFrom, rangeAt(to, nextScrollY));
			const fromById = new Map<string, Rect>();
			for (let i = union[0]; i < union[1]; i++) {
				fromById.set(current[i].id, from.rects[i]);
			}
			animating.current = true;
			flip.current = {
				fromById,
				scrollTo: nextScrollY,
				scrollDelta: nextScrollY - scrollY,
				live,
			};
			setRange(union);
			setCols(target);
			storeColumns(target);
		},
		[width, rangeAt],
	);

	// FLIP: the plates are already in their new places; start them where they
	// were on screen and let the compositor carry them over.
	useLayoutEffect(() => {
		const pending = flip.current;
		if (!pending) return;
		flip.current = null;
		// The new layout is in the DOM now, so this scroll lands where computed.
		window.scrollTo({ top: pending.scrollTo, behavior: "instant" });
		const elements = [...tiles.current.entries()];
		const finish = () => {
			for (const [, { element }] of elements) {
				element.style.transition = "";
				element.style.transform = "";
				element.style.willChange = "";
			}
			animating.current = false;
			// Pages may have arrived meanwhile, so read the range off the live layout.
			setRange(rangeAt(layoutRef.current, window.scrollY));
		};
		if (reducedMotion()) {
			finish();
			return;
		}
		for (const [id, { element, index }] of elements) {
			let start = pending.fromById.get(id);
			const end = layout.rects[index];
			if (!start || !end) continue;
			if (pending.live) {
				start = scaleRect(
					start,
					pending.live.s,
					pending.live.ox,
					pending.live.oy,
				);
			}
			const dx = start.x - end.x;
			const dy = start.y + pending.scrollDelta - end.y;
			element.style.transition = "none";
			element.style.transform = `translate(${dx}px, ${dy}px) scale(${start.w / end.w}, ${start.h / end.h})`;
			element.style.willChange = "transform";
		}
		// Commit the start frame before the transition is switched on.
		void containerRef.current?.offsetWidth;
		for (const [, { element }] of elements) {
			element.style.transition = `transform ${ZOOM_MS}ms ${ZOOM_EASE}`;
			element.style.transform = "translate(0px, 0px) scale(1, 1)";
		}
		// Not cancelled when the layout changes again mid-flight: a page arriving
		// during the transition must not leave the grid flagged as animating.
		flipTimer.current = window.setTimeout(finish, ZOOM_MS + 30);
	}, [layout, rangeAt]);

	useEffect(() => () => window.clearTimeout(flipTimer.current), []);

	// Pinch on touch screens, ctrl+wheel on trackpads: live scale, then snap.
	useEffect(() => {
		const container = containerRef.current;
		if (!container || !measured) return;
		let gesture: {
			cols: number;
			s: number;
			clientX: number;
			clientY: number;
			ox: number;
			oy: number;
			d0: number;
		} | null = null;
		let wheelTimer = 0;

		const begin = (clientX: number, clientY: number, d0: number) => {
			const ox = clientX - documentLeft(container);
			const oy = window.scrollY + clientY - documentTop(container);
			gesture = {
				cols: layoutRef.current.cols,
				s: 1,
				clientX,
				clientY,
				ox,
				oy,
				d0,
			};
			gesturing.current = true;
			container.style.transformOrigin = `${ox}px ${oy}px`;
			container.style.willChange = "transform";
		};
		const apply = (s: number) => {
			if (!gesture) return;
			gesture.s = clampPinchScale(zoomLevels(width), gesture.cols, s);
			container.style.transform = `scale(${gesture.s})`;
		};
		const commit = () => {
			if (!gesture) return;
			const g = gesture;
			gesture = null;
			container.style.willChange = "";
			const target = columnsAfterPinch(zoomLevels(width), g.cols, g.s);
			if (target === g.cols) {
				container.style.transition = `transform 200ms ${ZOOM_EASE}`;
				container.style.transform = "scale(1)";
				window.setTimeout(() => {
					container.style.transition = "";
					container.style.transform = "";
					gesturing.current = false;
				}, 220);
				return;
			}
			zoomTo(target, g.clientX, g.clientY, { s: g.s, ox: g.ox, oy: g.oy });
		};

		const distance = (touches: TouchList) =>
			Math.hypot(
				touches[0].clientX - touches[1].clientX,
				touches[0].clientY - touches[1].clientY,
			);
		const onTouchStart = (event: TouchEvent) => {
			if (event.touches.length !== 2 || animating.current) return;
			const [a, b] = [event.touches[0], event.touches[1]];
			begin(
				(a.clientX + b.clientX) / 2,
				(a.clientY + b.clientY) / 2,
				distance(event.touches),
			);
		};
		const onTouchMove = (event: TouchEvent) => {
			if (!gesture || event.touches.length < 2) return;
			event.preventDefault();
			apply(distance(event.touches) / gesture.d0);
		};
		const onTouchEnd = (event: TouchEvent) => {
			if (gesture && event.touches.length < 2) commit();
		};
		const onWheel = (event: WheelEvent) => {
			if (!event.ctrlKey || animating.current) return;
			event.preventDefault();
			if (!gesture) begin(event.clientX, event.clientY, 1);
			if (!gesture) return;
			apply(gesture.s * Math.exp(-event.deltaY * 0.01));
			window.clearTimeout(wheelTimer);
			wheelTimer = window.setTimeout(commit, 160);
		};

		container.addEventListener("touchstart", onTouchStart, { passive: true });
		container.addEventListener("touchmove", onTouchMove, { passive: false });
		container.addEventListener("touchend", onTouchEnd);
		container.addEventListener("touchcancel", onTouchEnd);
		container.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			container.removeEventListener("touchstart", onTouchStart);
			container.removeEventListener("touchmove", onTouchMove);
			container.removeEventListener("touchend", onTouchEnd);
			container.removeEventListener("touchcancel", onTouchEnd);
			container.removeEventListener("wheel", onWheel);
			window.clearTimeout(wheelTimer);
		};
	}, [measured, width, zoomTo]);

	const zoomBy = useCallback(
		(step: -1 | 1) => {
			const container = containerRef.current;
			if (!container) return;
			const index = levels.indexOf(layoutRef.current.cols);
			const target = levels[index + step];
			if (target === undefined) return;
			const box = container.getBoundingClientRect();
			const vh = window.innerHeight;
			// Anchor on the middle of the grid's visible part.
			const visibleTop = Math.max(0, box.top);
			const visibleBottom = Math.min(vh, box.bottom);
			zoomTo(
				target,
				box.left + box.width / 2,
				(visibleTop + visibleBottom) / 2,
				null,
			);
		},
		[levels, zoomTo],
	);

	const register = useCallback(
		(id: string, index: number, element: HTMLElement | null) => {
			if (element) tiles.current.set(id, { element, index });
			else tiles.current.delete(id);
		},
		[],
	);

	const levelIndex = levels.indexOf(layout.cols);
	return {
		containerRef,
		measured,
		layout,
		range,
		levels,
		register,
		zoomIn: () => zoomBy(-1),
		zoomOut: () => zoomBy(1),
		canZoomIn: levelIndex > 0,
		canZoomOut: levelIndex >= 0 && levelIndex < levels.length - 1,
	};
}
