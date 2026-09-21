import { type AnimationPlaybackControls, animate } from "motion";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {
	GALLERY_SPRING,
	type GalleryRows,
	galleryRowsAfterZoom,
} from "@/components/gallery/horizontal-gallery";

type ScrollAnchor = {
	photoId: string;
	plateFraction: number;
	viewportOffset: number;
};

type FocalPoint = {
	x: number;
	y: number;
};

const PINCH_IN_THRESHOLD = 1.18;
const PINCH_OUT_THRESHOLD = 0.82;

function plates(viewport: HTMLElement) {
	return Array.from(viewport.querySelectorAll<HTMLElement>("[data-photo-id]"));
}

function firstVisiblePlate(viewport: HTMLElement) {
	const edge = viewport.getBoundingClientRect().left + 1;
	return plates(viewport).find(
		(candidate) => candidate.getBoundingClientRect().right > edge,
	);
}

function firstVisibleAnchor(viewport: HTMLElement): ScrollAnchor | null {
	const plate = firstVisiblePlate(viewport);
	if (!plate?.dataset.photoId) return null;
	return {
		photoId: plate.dataset.photoId,
		plateFraction: 0,
		viewportOffset:
			plate.getBoundingClientRect().left -
			viewport.getBoundingClientRect().left,
	};
}

function focalAnchor(
	viewport: HTMLElement,
	clientX: number,
	clientY: number,
): ScrollAnchor | null {
	const viewportRect = viewport.getBoundingClientRect();
	const candidates = plates(viewport);
	const plate =
		candidates.find((candidate) => {
			const rect = candidate.getBoundingClientRect();
			return (
				clientX >= rect.left &&
				clientX <= rect.right &&
				clientY >= rect.top &&
				clientY <= rect.bottom
			);
		}) ??
		candidates.reduce<HTMLElement | undefined>((nearest, candidate) => {
			if (!nearest) return candidate;
			const distance = (element: HTMLElement) => {
				const rect = element.getBoundingClientRect();
				const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
				const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
				return Math.hypot(dx, dy);
			};
			return distance(candidate) < distance(nearest) ? candidate : nearest;
		}, undefined);
	if (!plate?.dataset.photoId) return null;
	const rect = plate.getBoundingClientRect();
	return {
		photoId: plate.dataset.photoId,
		plateFraction: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
		viewportOffset: clientX - viewportRect.left,
	};
}

function touchDistance(touches: TouchList) {
	return Math.hypot(
		touches[0].clientX - touches[1].clientX,
		touches[0].clientY - touches[1].clientY,
	);
}

function touchCenter(touches: TouchList): FocalPoint {
	return {
		x: (touches[0].clientX + touches[1].clientX) / 2,
		y: (touches[0].clientY + touches[1].clientY) / 2,
	};
}

export function useHorizontalGallery({
	itemCount,
	hasMore,
	pending,
	onLoadMore,
	reduceMotion,
}: {
	itemCount: number;
	hasMore: boolean;
	pending: boolean;
	onLoadMore: () => void;
	reduceMotion: boolean;
}) {
	const viewportRef = useRef<HTMLElement>(null);
	const anchorRef = useRef<ScrollAnchor | null>(null);
	const scrollAnimationRef = useRef<AnimationPlaybackControls | null>(null);
	const [rows, setRows] = useState<GalleryRows>(2);
	const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
	const contentSize = `${itemCount}:${rows}`;

	const loadNearEnd = useCallback(() => {
		const viewport = viewportRef.current;
		if (!viewport || !hasMore || pending) return;
		const remaining =
			viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft;
		if (remaining <= viewport.clientWidth * 0.75) onLoadMore();
	}, [hasMore, pending, onLoadMore]);

	useEffect(() => {
		if (!contentSize) return;
		const frame = window.requestAnimationFrame(loadNearEnd);
		return () => window.cancelAnimationFrame(frame);
	}, [contentSize, loadNearEnd]);

	useLayoutEffect(() => {
		if (itemCount === 0) return;
		const viewport = viewportRef.current;
		if (!viewport) return;
		const measure = () => {
			const next = {
				width: viewport.clientWidth,
				height: viewport.clientHeight,
			};
			setViewportSize((current) =>
				current.width === next.width && current.height === next.height
					? current
					: next,
			);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(viewport);
		return () => observer.disconnect();
	}, [itemCount]);

	useEffect(() => {
		if (itemCount === 0) return;
		const viewport = viewportRef.current;
		if (!viewport) return;
		const onWheel = (event: WheelEvent) => {
			if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX))
				return;
			const max = viewport.scrollWidth - viewport.clientWidth;
			const canMove =
				(event.deltaY > 0 && viewport.scrollLeft < max) ||
				(event.deltaY < 0 && viewport.scrollLeft > 0);
			if (!canMove) return;
			event.preventDefault();
			viewport.scrollLeft += event.deltaY;
		};
		viewport.addEventListener("wheel", onWheel, { passive: false });
		return () => viewport.removeEventListener("wheel", onWheel);
	}, [itemCount]);

	const changeRows = useCallback(
		(direction: "in" | "out", focalPoint?: FocalPoint) => {
			const next = galleryRowsAfterZoom(rows, direction);
			if (next === rows) return;
			const viewport = viewportRef.current;
			if (viewport) {
				anchorRef.current = focalPoint
					? focalAnchor(viewport, focalPoint.x, focalPoint.y)
					: firstVisibleAnchor(viewport);
			}
			setRows(next);
		},
		[rows],
	);

	useEffect(() => {
		if (itemCount === 0) return;
		const viewport = viewportRef.current;
		if (!viewport) return;
		let startDistance = 0;
		let touchTracking = false;
		let wheelScale = 1;
		let wheelLocked = false;
		let wheelTimer = 0;

		const resetWheel = () => {
			wheelScale = 1;
			wheelLocked = false;
		};
		const onTouchStart = (event: TouchEvent) => {
			if (event.touches.length !== 2) return;
			event.preventDefault();
			startDistance = touchDistance(event.touches);
			touchTracking = true;
		};
		const onTouchMove = (event: TouchEvent) => {
			if (event.touches.length !== 2) return;
			event.preventDefault();
			if (!touchTracking || startDistance === 0) return;
			const scale = touchDistance(event.touches) / startDistance;
			if (scale >= PINCH_IN_THRESHOLD) {
				changeRows("in", touchCenter(event.touches));
				touchTracking = false;
			} else if (scale <= PINCH_OUT_THRESHOLD) {
				changeRows("out", touchCenter(event.touches));
				touchTracking = false;
			}
		};
		const onTouchEnd = () => {
			touchTracking = false;
			startDistance = 0;
		};
		const onWheel = (event: WheelEvent) => {
			if (!event.ctrlKey) return;
			event.preventDefault();
			window.clearTimeout(wheelTimer);
			if (!wheelLocked) {
				wheelScale *= Math.exp(-event.deltaY * 0.01);
				const focalPoint = { x: event.clientX, y: event.clientY };
				if (wheelScale >= PINCH_IN_THRESHOLD) {
					changeRows("in", focalPoint);
					wheelLocked = true;
				} else if (wheelScale <= PINCH_OUT_THRESHOLD) {
					changeRows("out", focalPoint);
					wheelLocked = true;
				}
			}
			wheelTimer = window.setTimeout(resetWheel, 180);
		};
		const preventGesture = (event: Event) => event.preventDefault();

		viewport.addEventListener("touchstart", onTouchStart, { passive: false });
		viewport.addEventListener("touchmove", onTouchMove, { passive: false });
		viewport.addEventListener("touchend", onTouchEnd);
		viewport.addEventListener("touchcancel", onTouchEnd);
		viewport.addEventListener("wheel", onWheel, { passive: false });
		viewport.addEventListener("gesturestart", preventGesture);
		viewport.addEventListener("gesturechange", preventGesture);
		return () => {
			viewport.removeEventListener("touchstart", onTouchStart);
			viewport.removeEventListener("touchmove", onTouchMove);
			viewport.removeEventListener("touchend", onTouchEnd);
			viewport.removeEventListener("touchcancel", onTouchEnd);
			viewport.removeEventListener("wheel", onWheel);
			viewport.removeEventListener("gesturestart", preventGesture);
			viewport.removeEventListener("gesturechange", preventGesture);
			window.clearTimeout(wheelTimer);
		};
	}, [changeRows, itemCount]);

	useLayoutEffect(() => {
		const anchor = anchorRef.current;
		const viewport = viewportRef.current;
		if (!anchor || !viewport) return;
		anchorRef.current = null;
		const plate = viewport.querySelector<HTMLElement>(
			`[data-photo-id="${CSS.escape(anchor.photoId)}"]`,
		);
		if (!plate) return;
		const x = Number(plate.dataset.galleryX);
		const width = Number(plate.dataset.galleryWidth);
		if (!Number.isFinite(x) || !Number.isFinite(width)) return;
		const target = Math.max(
			0,
			Math.min(
				x + width * anchor.plateFraction - anchor.viewportOffset,
				viewport.scrollWidth - viewport.clientWidth,
			),
		);
		scrollAnimationRef.current?.stop();
		if (reduceMotion) {
			viewport.scrollLeft = target;
			return;
		}
		scrollAnimationRef.current = animate(viewport.scrollLeft, target, {
			...GALLERY_SPRING,
			onUpdate: (value) => {
				viewport.scrollLeft = value;
			},
		});
	});

	useEffect(
		() => () => {
			scrollAnimationRef.current?.stop();
		},
		[],
	);

	return {
		viewportRef,
		viewportSize,
		rows,
		onScroll: loadNearEnd,
		zoomIn: () => changeRows("in"),
		zoomOut: () => changeRows("out"),
		canZoomIn: rows > 1,
		canZoomOut: rows < 3,
	};
}
