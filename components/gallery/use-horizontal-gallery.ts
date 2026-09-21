import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {
	type GalleryRows,
	galleryRowsAfterZoom,
} from "@/components/gallery/horizontal-gallery";

type ScrollAnchor = {
	photoId: string;
	offset: number;
};

function firstVisiblePlate(viewport: HTMLElement) {
	const edge = viewport.scrollLeft + 1;
	return Array.from(
		viewport.querySelectorAll<HTMLElement>("[data-photo-id]"),
	).find((plate) => plate.offsetLeft + plate.offsetWidth > edge);
}

/**
 * Native horizontal scrolling with a fixed-height rail. Zoom only changes how
 * many rows share that height; the first visible photograph stays anchored.
 */
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
	const viewportRef = useRef<HTMLDivElement>(null);
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
		const viewport = viewportRef.current;
		if (!viewport) return;
		const onWheel = (event: WheelEvent) => {
			if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
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
	}, []);

	useLayoutEffect(() => {
		const anchor = anchorRef.current;
		const viewport = viewportRef.current;
		if (!anchor || !viewport) return;
		anchorRef.current = null;
		const plate = viewport.querySelector<HTMLElement>(
			`[data-photo-id="${CSS.escape(anchor.photoId)}"]`,
		);
		if (plate) viewport.scrollLeft = plate.offsetLeft - anchor.offset;
	});

	const zoom = useCallback(
		(direction: "in" | "out") => {
			const next = galleryRowsAfterZoom(rows, direction);
			if (next === rows) return;
			const viewport = viewportRef.current;
			const plate = viewport ? firstVisiblePlate(viewport) : undefined;
			if (viewport && plate) {
				anchorRef.current = {
					photoId: plate.dataset.photoId ?? "",
					offset: plate.offsetLeft - viewport.scrollLeft,
				};
			}
			setRows(next);
		},
		[rows],
	);

	return {
		viewportRef,
		rows,
		onScroll: loadNearEnd,
		zoomIn: () => zoom("in"),
		zoomOut: () => zoom("out"),
		canZoomIn: rows > 1,
		canZoomOut: rows < 3,
	};
}
