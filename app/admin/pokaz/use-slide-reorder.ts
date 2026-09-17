import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
} from "react";
import type { AdminSlide } from "@/lib/slideshow";

/**
 * Handle-based drag reordering that works with mouse and touch alike. Move and
 * up listeners live on `window`, not on the handle: reordering re-parents the
 * row's DOM node, which would break pointer capture mid-drag.
 */
export function useSlideReorder({
	slides,
	setSlides,
	setDragId,
	onDrop,
}: {
	slides: AdminSlide[];
	setSlides: (update: (current: AdminSlide[]) => AdminSlide[]) => void;
	setDragId: (id: string | null) => void;
	onDrop: (order: AdminSlide[]) => void;
}) {
	const rowRefs = useRef(new Map<string, HTMLLIElement>());
	const endDragRef = useRef<((commit: boolean) => void) | null>(null);
	const slidesRef = useRef(slides);
	slidesRef.current = slides;

	useEffect(() => () => endDragRef.current?.(false), []);

	function onDragStart(event: ReactPointerEvent, slideId: string) {
		event.preventDefault();
		endDragRef.current?.(false);
		setDragId(slideId);

		const onMove = (moveEvent: PointerEvent) => {
			const y = moveEvent.clientY;
			setSlides((current) => {
				const from = current.findIndex((slide) => slide.id === slideId);
				if (from === -1) return current;
				let to = from;
				current.forEach((slide, i) => {
					if (i === from) return;
					const row = rowRefs.current.get(slide.id);
					if (!row) return;
					const rect = row.getBoundingClientRect();
					const middle = rect.top + rect.height / 2;
					if (i < from && y < middle) to = Math.min(to, i);
					if (i > from && y > middle) to = Math.max(to, i);
				});
				if (to === from) return current;
				const next = [...current];
				const [slide] = next.splice(from, 1);
				next.splice(to, 0, slide);
				slidesRef.current = next;
				return next;
			});
		};
		const endDrag = (commit: boolean) => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onCancel);
			endDragRef.current = null;
			setDragId(null);
			if (commit) onDrop(slidesRef.current);
		};
		const onUp = () => endDrag(true);
		const onCancel = () => endDrag(false);
		endDragRef.current = endDrag;
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onCancel);
	}

	function registerRow(slideId: string, element: HTMLLIElement | null) {
		if (element) rowRefs.current.set(slideId, element);
		else rowRefs.current.delete(slideId);
	}

	return { onDragStart, registerRow };
}
