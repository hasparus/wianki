import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {
	type GalleryRows,
	galleryRowsAfterPinch,
	galleryRowsAfterZoom,
} from "@/components/gallery/horizontal-gallery";

type ScrollAnchor = {
	photoId: string;
	plateFraction: number;
	viewportOffset: number;
};

type PinchGesture = {
	anchor: ScrollAnchor | null;
	distance: number;
	scale: number;
	x: number;
	y: number;
};

function plates(viewport: HTMLElement) {
	return Array.from(viewport.querySelectorAll<HTMLElement>("[data-photo-id]"));
}

function firstVisiblePlate(viewport: HTMLElement) {
	const edge = viewport.scrollLeft + 1;
	return plates(viewport).find(
		(candidate) => candidate.offsetLeft + candidate.offsetWidth > edge,
	);
}

function firstVisibleAnchor(viewport: HTMLElement): ScrollAnchor | null {
	const plate = firstVisiblePlate(viewport);
	if (!plate?.dataset.photoId) return null;
	return {
		photoId: plate.dataset.photoId,
		plateFraction: 0,
		viewportOffset: plate.offsetLeft - viewport.scrollLeft,
	};
}

function focalAnchor(
	viewport: HTMLElement,
	clientX: number,
	clientY: number,
): ScrollAnchor | null {
	const viewportRect = viewport.getBoundingClientRect();
	const plate =
		plates(viewport).find((candidate) => {
			const rect = candidate.getBoundingClientRect();
			return (
				clientX >= rect.left &&
				clientX <= rect.right &&
				clientY >= rect.top &&
				clientY <= rect.bottom
			);
		}) ?? firstVisiblePlate(viewport);
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

function touchCenter(touches: TouchList) {
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
}: {
	itemCount: number;
	hasMore: boolean;
	pending: boolean;
	onLoadMore: () => void;
}) {
	const viewportRef = useRef<HTMLElement>(null);
	const contentRef = useRef<HTMLUListElement>(null);
	const anchorRef = useRef<ScrollAnchor | null>(null);
	const [rows, setRows] = useState<GalleryRows>(2);
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

	useEffect(() => {
		if (itemCount === 0) return;
		const viewport = viewportRef.current;
		const content = contentRef.current;
		if (!viewport || !content) return;
		let gesture: PinchGesture | null = null;
		let wheelTimer = 0;
		let resetTimer = 0;

		const begin = (x: number, y: number, distance: number) => {
			window.clearTimeout(resetTimer);
			const viewportRect = viewport.getBoundingClientRect();
			gesture = {
				anchor: focalAnchor(viewport, x, y),
				distance,
				scale: 1,
				x,
				y,
			};
			content.style.transition = "";
			content.style.transformOrigin = `${viewport.scrollLeft + x - viewportRect.left}px ${y - viewportRect.top}px`;
			content.style.willChange = "transform";
		};

		const apply = (scale: number) => {
			if (!gesture) return;
			gesture.scale = Math.max(0.55, Math.min(1.8, scale));
			content.style.transform = `scale(${gesture.scale})`;
		};

		const clearTransform = () => {
			content.style.transition = "";
			content.style.transform = "";
			content.style.transformOrigin = "";
			content.style.willChange = "";
		};

		const commit = () => {
			if (!gesture) return;
			const finished = gesture;
			gesture = null;
			const target = galleryRowsAfterPinch(rows, finished.scale);
			if (target !== rows) {
				clearTransform();
				anchorRef.current = finished.anchor;
				setRows(target);
				return;
			}
			content.style.transition = "transform 140ms ease-out";
			content.style.transform = "scale(1)";
			resetTimer = window.setTimeout(clearTransform, 160);
		};

		const onTouchStart = (event: TouchEvent) => {
			if (event.touches.length !== 2) return;
			const center = touchCenter(event.touches);
			begin(center.x, center.y, touchDistance(event.touches));
		};
		const onTouchMove = (event: TouchEvent) => {
			if (!gesture || event.touches.length !== 2) return;
			event.preventDefault();
			apply(touchDistance(event.touches) / gesture.distance);
		};
		const onTouchEnd = (event: TouchEvent) => {
			if (gesture && event.touches.length < 2) commit();
		};
		const onWheel = (event: WheelEvent) => {
			if (!event.ctrlKey) return;
			event.preventDefault();
			if (!gesture) begin(event.clientX, event.clientY, 1);
			if (!gesture) return;
			apply(gesture.scale * Math.exp(-event.deltaY * 0.01));
			window.clearTimeout(wheelTimer);
			wheelTimer = window.setTimeout(commit, 160);
		};

		viewport.addEventListener("touchstart", onTouchStart, { passive: true });
		viewport.addEventListener("touchmove", onTouchMove, { passive: false });
		viewport.addEventListener("touchend", onTouchEnd);
		viewport.addEventListener("touchcancel", onTouchEnd);
		viewport.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			viewport.removeEventListener("touchstart", onTouchStart);
			viewport.removeEventListener("touchmove", onTouchMove);
			viewport.removeEventListener("touchend", onTouchEnd);
			viewport.removeEventListener("touchcancel", onTouchEnd);
			viewport.removeEventListener("wheel", onWheel);
			window.clearTimeout(wheelTimer);
			window.clearTimeout(resetTimer);
			clearTransform();
		};
	}, [rows, itemCount]);

	useLayoutEffect(() => {
		const anchor = anchorRef.current;
		const viewport = viewportRef.current;
		if (!anchor || !viewport) return;
		anchorRef.current = null;
		const plate = viewport.querySelector<HTMLElement>(
			`[data-photo-id="${CSS.escape(anchor.photoId)}"]`,
		);
		if (!plate) return;
		viewport.scrollLeft =
			plate.offsetLeft +
			plate.offsetWidth * anchor.plateFraction -
			anchor.viewportOffset;
	});

	const zoom = useCallback(
		(direction: "in" | "out") => {
			const next = galleryRowsAfterZoom(rows, direction);
			if (next === rows) return;
			const viewport = viewportRef.current;
			if (viewport) anchorRef.current = firstVisibleAnchor(viewport);
			setRows(next);
		},
		[rows],
	);

	return {
		viewportRef,
		contentRef,
		rows,
		onScroll: loadNearEnd,
		zoomIn: () => zoom("in"),
		zoomOut: () => zoom("out"),
		canZoomIn: rows > 1,
		canZoomOut: rows < 3,
	};
}
