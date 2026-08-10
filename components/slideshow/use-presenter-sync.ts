import { useCallback, useEffect, useRef, useState } from "react";
import type { SlideshowLive } from "@/components/slideshow/use-slideshow-live";
import type { SlideshowSlide } from "@/lib/slideshow";
import { clampSlideSeconds, resolveShowIndex } from "@/lib/slideshow-protocol";

const NOTICE_MS = 4000;

/**
 * Keeps one screen in step with the room: an admin device claims the show as
 * soon as it connects and mirrors its own position into the room, everyone
 * else follows the presenter until they swipe away. All the cross-device
 * coordination lives here so the view only renders what it is told.
 */
export function usePresenterSync({
	live,
	slides,
	index,
	playing,
	goTo,
	fallbackSeconds,
}: {
	live: SlideshowLive;
	slides: SlideshowSlide[];
	index: number;
	playing: boolean;
	goTo: (target: number) => void;
	fallbackSeconds: number;
}) {
	const [yielded, setYielded] = useState(false);
	const [detached, setDetached] = useState(false);
	const [notice, setNotice] = useState("");
	const wasPresenterRef = useRef(false);
	const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	const isAdmin = live.role === "admin" && live.status === "on";
	const roomHasTempo = live.show.slideSeconds !== null;
	const claiming = isAdmin && !yielded;
	const following = live.isLive && !live.isPresenter && !detached;
	const slideMs =
		clampSlideSeconds(live.show.slideSeconds ?? fallbackSeconds) * 1000;

	const takeBack = useCallback(() => {
		setDetached(false);
		setYielded(false);
	}, []);

	const detach = useCallback(() => setDetached(true), []);
	// Rejoining the live show is not the same as claiming it back: an admin who
	// yielded stays a viewer until they press "Przejmij pokaz".
	const reattach = useCallback(() => setDetached(false), []);

	useEffect(() => () => clearTimeout(noticeTimerRef.current), []);

	useEffect(() => {
		if (!claiming || live.connectionEpoch === 0) return;
		live.sendControl({ action: "steer" });
	}, [claiming, live.connectionEpoch, live.sendControl]);

	useEffect(() => {
		if (!live.isPresenter || roomHasTempo) return;
		live.sendControl({ action: "tempo", slideSeconds: fallbackSeconds });
	}, [live.isPresenter, roomHasTempo, live.sendControl, fallbackSeconds]);

	useEffect(() => {
		if (!live.isPresenter) return;
		live.sendControl({
			action: "goto",
			index,
			slideId: slides[index]?.id ?? null,
			playing,
		});
	}, [live.isPresenter, live.sendControl, index, playing, slides]);

	useEffect(() => {
		if (live.isPresenter) {
			wasPresenterRef.current = true;
			return;
		}
		if (wasPresenterRef.current && live.isLive) {
			wasPresenterRef.current = false;
			setYielded(true);
			setNotice("Pokaz prowadzi teraz inne urządzenie.");
			clearTimeout(noticeTimerRef.current);
			noticeTimerRef.current = setTimeout(() => setNotice(""), NOTICE_MS);
		}
	}, [live.isPresenter, live.isLive]);

	useEffect(() => {
		if (!following) return;
		const target = resolveShowIndex(
			live.show,
			slides.map((slide) => slide.id),
		);
		if (target !== null && target !== index) goTo(target);
	}, [following, live.show, slides, index, goTo]);

	useEffect(() => {
		if (!live.isLive) takeBack();
	}, [live.isLive, takeBack]);

	return {
		slideMs,
		following,
		detached,
		notice,
		canTakeOver: isAdmin && yielded && live.isLive,
		detach,
		reattach,
		takeBack,
	};
}
