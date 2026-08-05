"use client";

import Image from "next/image";
import Link from "next/link";
import {
	type FormEvent,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { BubbleLayer } from "@/components/slideshow/bubble-layer";
import { useSlideshowLive } from "@/components/slideshow/use-slideshow-live";
import type { SlideshowDeck, SlideshowSlide } from "@/lib/slideshow";
import {
	MAX_COMMENT_LENGTH,
	REACTION_EMOJI,
	resolveShowIndex,
} from "@/lib/slideshow-live";

const SLIDE_MS = 8000;
const CROSSFADE_MS = 900;
const SWIPE_THRESHOLD_PX = 48;
const NOTICE_MS = 4000;

const reactionLabels: Record<string, string> = {
	"❤️": "serce",
	"🥂": "toast",
	"😂": "śmiech",
	"👏": "brawa",
	"🥹": "wzruszenie",
};

function SlideView({
	slide,
	className,
}: {
	slide: SlideshowSlide;
	className: string;
}) {
	if (slide.kind === "text") {
		return (
			<div className={`absolute inset-0 ${className}`}>
				<div className="grid h-full place-items-center px-8 text-center">
					<div>
						<p className="font-serif text-4xl font-bold text-balance sm:text-6xl">
							{slide.title}
						</p>
						{slide.subtitle ? (
							<p className="mt-5 text-lg text-wedding-rose sm:text-2xl">
								{slide.subtitle}
							</p>
						) : null}
					</div>
				</div>
			</div>
		);
	}
	return (
		<figure className={`absolute inset-0 m-0 ${className}`}>
			{slide.imageUrl ? (
				<Image
					src={slide.imageUrl}
					alt=""
					width={slide.width ?? 1600}
					height={slide.height ?? 1200}
					unoptimized
					priority
					draggable={false}
					className="h-full w-full object-contain"
				/>
			) : null}
			{slide.title ? (
				<figcaption className="absolute inset-x-0 bottom-28 px-6 text-center sm:bottom-32">
					<span className="inline-block max-w-2xl rounded-2xl bg-wedding-green-deep/70 px-5 py-2 font-serif text-xl text-balance sm:text-2xl">
						{slide.title}
						{slide.subtitle ? (
							<span className="mt-1 block text-base text-wedding-rose sm:text-lg">
								{slide.subtitle}
							</span>
						) : null}
					</span>
				</figcaption>
			) : null}
		</figure>
	);
}

export function SlideshowClient({ deck }: { deck: SlideshowDeck }) {
	const { slides } = deck;
	const [index, setIndex] = useState(0);
	const [previousIndex, setPreviousIndex] = useState<number | null>(null);
	const [playing, setPlaying] = useState(true);
	const [steering, setSteering] = useState(false);
	const [detached, setDetached] = useState(false);
	const [notice, setNotice] = useState("");
	const [comment, setComment] = useState("");
	const pointerStart = useRef<{ x: number; y: number } | null>(null);
	const wasPresenterRef = useRef(false);
	const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const live = useSlideshowLive();

	// A live show exists and this device neither drives it nor opted out.
	const following = live.show.live && !steering && !detached;
	// Local autoplay runs whenever this device owns its own timeline.
	const autoplaying = playing && !following;

	const goTo = useCallback(
		(target: number) => {
			if (slides.length < 2) return;
			setIndex((current) => {
				const next = (target + slides.length) % slides.length;
				if (next !== current) setPreviousIndex(current);
				return next;
			});
		},
		[slides.length],
	);

	const navigate = useCallback(
		(target: number) => {
			if (following) setDetached(true);
			goTo(target);
		},
		[following, goTo],
	);

	const showNotice = useCallback((text: string) => {
		setNotice(text);
		clearTimeout(noticeTimerRef.current);
		noticeTimerRef.current = setTimeout(() => setNotice(""), NOTICE_MS);
	}, []);

	useEffect(() => () => clearTimeout(noticeTimerRef.current), []);

	useEffect(() => {
		if (previousIndex === null) return;
		const timer = setTimeout(() => setPreviousIndex(null), CROSSFADE_MS);
		return () => clearTimeout(timer);
	}, [previousIndex]);

	useEffect(() => {
		if (!autoplaying || slides.length < 2) return;
		const timer = setTimeout(() => goTo(index + 1), SLIDE_MS);
		return () => clearTimeout(timer);
	}, [autoplaying, index, slides.length, goTo]);

	// Steering: (re-)claim the show on every (re)connection…
	useEffect(() => {
		if (!steering || live.connectionEpoch === 0) return;
		live.sendControl({ action: "steer" });
	}, [steering, live.connectionEpoch, live.sendControl]);

	// …and mirror every local position/play change to the room.
	useEffect(() => {
		if (!steering || live.connectionEpoch === 0) return;
		live.sendControl({
			action: "goto",
			index,
			slideId: slides[index]?.id ?? null,
			playing,
		});
	}, [
		steering,
		live.connectionEpoch,
		live.sendControl,
		index,
		playing,
		slides,
	]);

	// Another admin took over: stop pretending to steer.
	useEffect(() => {
		if (!steering) {
			wasPresenterRef.current = false;
			return;
		}
		if (live.isPresenter) wasPresenterRef.current = true;
		if (
			wasPresenterRef.current &&
			live.show.presenterId !== null &&
			!live.isPresenter
		) {
			setSteering(false);
			showNotice("Ktoś inny prowadzi teraz pokaz.");
		}
	}, [steering, live.show.presenterId, live.isPresenter, showNotice]);

	// Follow the presenter.
	useEffect(() => {
		if (!following) return;
		const target = resolveShowIndex(
			live.show,
			slides.map((slide) => slide.id),
		);
		if (target !== null && target !== index) goTo(target);
	}, [following, live.show, slides, index, goTo]);

	// When the show ends, everyone resumes their own pace.
	useEffect(() => {
		if (!live.show.live) setDetached(false);
	}, [live.show.live]);

	useEffect(() => {
		const next = slides[(index + 1) % slides.length];
		if (next?.imageUrl) {
			const preload = new window.Image();
			preload.src = next.imageUrl;
		}
	}, [index, slides]);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.target instanceof HTMLInputElement) return;
			if (event.key === "ArrowRight") navigate(index + 1);
			if (event.key === "ArrowLeft") navigate(index - 1);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [navigate, index]);

	// The show often runs propped up on a phone — keep the screen awake.
	useEffect(() => {
		if ((!playing && !following) || !("wakeLock" in navigator)) return;
		let lock: WakeLockSentinel | null = null;
		navigator.wakeLock
			.request("screen")
			.then((sentinel) => {
				lock = sentinel;
			})
			.catch(() => {});
		return () => {
			lock?.release().catch(() => {});
		};
	}, [playing, following]);

	function toggleSteering() {
		if (steering) {
			setSteering(false);
			live.sendControl({ action: "release" });
			return;
		}
		setDetached(false);
		setSteering(true);
	}

	function onPointerDown(event: ReactPointerEvent) {
		pointerStart.current = { x: event.clientX, y: event.clientY };
	}

	function onPointerUp(event: ReactPointerEvent) {
		const start = pointerStart.current;
		pointerStart.current = null;
		if (!start) return;
		const dx = event.clientX - start.x;
		const dy = event.clientY - start.y;
		if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy))
			return;
		navigate(dx < 0 ? index + 1 : index - 1);
	}

	function submitComment(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		live.sendComment(comment);
		setComment("");
	}

	if (slides.length === 0) {
		return (
			<main className="slideshow-stage grid min-h-dvh place-items-center px-6 text-center text-wedding-ivory">
				<div>
					<h1 className="font-serif text-4xl font-bold">Pokaz slajdów</h1>
					<p className="mt-4 max-w-md text-lg">
						Jeszcze nie ma czego wyświetlić. Pokaz ułoży się sam z
						zatwierdzonych zdjęć galerii.
					</p>
					<Link
						href="/"
						className="mt-8 inline-block min-h-12 rounded-full border-2 border-wedding-ivory px-6 py-2.5 font-bold hover:bg-wedding-ivory/10"
					>
						Wróć do galerii
					</Link>
				</div>
			</main>
		);
	}

	const currentSlide = slides[index];
	const previousSlide = previousIndex === null ? null : slides[previousIndex];

	return (
		<main
			className="slideshow-stage relative h-dvh w-full touch-pan-y select-none overflow-hidden text-wedding-ivory"
			onPointerDown={onPointerDown}
			onPointerUp={onPointerUp}
			onPointerCancel={() => {
				pointerStart.current = null;
			}}
		>
			{previousSlide ? (
				<SlideView
					key={`prev-${previousIndex}`}
					slide={previousSlide}
					className="slideshow-slide-exit z-0"
				/>
			) : null}
			<SlideView
				key={`slide-${index}`}
				slide={currentSlide}
				className="slideshow-slide-enter z-10"
			/>

			<BubbleLayer bubbles={live.bubbles} onDone={live.dismissBubble} />

			<p aria-live="polite" className="sr-only">
				{live.lastComment}
			</p>

			<header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 p-4">
				<div className="flex items-center gap-2">
					<Link
						href="/"
						className="min-h-11 rounded-full bg-wedding-green-deep/60 px-5 py-2.5 text-sm font-bold backdrop-blur hover:bg-wedding-green-deep/80"
					>
						‹ Galeria
					</Link>
					{live.show.live ? (
						<span className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full bg-wedding-green-deep/60 px-4 text-sm font-bold backdrop-blur">
							<span
								aria-hidden
								className="size-2.5 animate-pulse rounded-full bg-wedding-rose"
							/>
							{steering ? "Prowadzisz" : "Na żywo"}
						</span>
					) : null}
				</div>
				<div className="flex items-center gap-2">
					{live.status === "on" ? (
						<span
							className="whitespace-nowrap rounded-full bg-wedding-green-deep/60 px-4 py-2.5 text-sm font-bold backdrop-blur"
							title="Liczba oglądających"
						>
							{live.viewers} 👀
						</span>
					) : null}
					<span className="whitespace-nowrap rounded-full bg-wedding-green-deep/60 px-4 py-2.5 text-sm font-bold tabular-nums backdrop-blur">
						{index + 1} / {slides.length}
					</span>
					{live.role === "admin" && live.status === "on" ? (
						<button
							type="button"
							onClick={toggleSteering}
							aria-pressed={steering}
							className={`min-h-11 rounded-full px-4 text-sm font-bold backdrop-blur ${
								steering
									? "bg-wedding-rose text-wedding-green"
									: "bg-wedding-green-deep/60 hover:bg-wedding-green-deep/80"
							}`}
						>
							{steering ? "Oddaj pokaz" : "Prowadź pokaz"}
						</button>
					) : null}
					{!following ? (
						<button
							type="button"
							onClick={() => setPlaying((value) => !value)}
							aria-label={playing ? "Zatrzymaj pokaz" : "Wznów pokaz"}
							className="min-h-11 min-w-11 rounded-full bg-wedding-green-deep/60 text-sm font-bold backdrop-blur hover:bg-wedding-green-deep/80"
						>
							{playing ? "⏸" : "▶"}
						</button>
					) : null}
				</div>
			</header>

			{notice ? (
				<p
					aria-live="polite"
					className="absolute inset-x-0 top-20 z-30 mx-auto w-fit rounded-full bg-wedding-ivory/95 px-5 py-2 text-sm font-bold text-wedding-green shadow-lg"
				>
					{notice}
				</p>
			) : null}

			{detached && live.show.live ? (
				<button
					type="button"
					onClick={() => setDetached(false)}
					className="absolute inset-x-0 top-20 z-30 mx-auto flex w-fit items-center gap-2 rounded-full bg-wedding-ivory/95 px-5 py-2.5 text-sm font-bold text-wedding-green shadow-lg hover:bg-wedding-cream"
				>
					<span
						aria-hidden
						className="size-2.5 animate-pulse rounded-full bg-wedding-error"
					/>
					Wróć do pokazu na żywo
				</button>
			) : null}

			{slides.length > 1 ? (
				<>
					<button
						type="button"
						onClick={() => navigate(index - 1)}
						aria-label="Poprzedni slajd"
						className="absolute left-3 top-1/2 z-30 hidden min-h-12 min-w-12 -translate-y-1/2 rounded-full bg-wedding-green-deep/50 text-xl font-bold backdrop-blur hover:bg-wedding-green-deep/80 sm:block"
					>
						‹
					</button>
					<button
						type="button"
						onClick={() => navigate(index + 1)}
						aria-label="Następny slajd"
						className="absolute right-3 top-1/2 z-30 hidden min-h-12 min-w-12 -translate-y-1/2 rounded-full bg-wedding-green-deep/50 text-xl font-bold backdrop-blur hover:bg-wedding-green-deep/80 sm:block"
					>
						›
					</button>
				</>
			) : null}

			{live.status === "on" ? (
				<footer className="absolute inset-x-0 bottom-0 z-30 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
					<div className="mx-auto grid w-full max-w-xl gap-3">
						{live.throttled ? (
							<p className="text-center text-sm font-semibold">
								Chwila oddechu — za dużo wiadomości naraz 🙂
							</p>
						) : null}
						<div className="flex justify-center gap-2">
							{REACTION_EMOJI.map((emoji) => (
								<button
									key={emoji}
									type="button"
									onClick={() => live.sendReaction(emoji)}
									aria-label={`Wyślij reakcję: ${reactionLabels[emoji] ?? emoji}`}
									className="min-h-12 min-w-12 rounded-full border border-wedding-ivory/25 bg-wedding-green-deep/50 text-2xl backdrop-blur transition hover:bg-wedding-green-deep/80 active:scale-90"
								>
									{emoji}
								</button>
							))}
						</div>
						<form onSubmit={submitComment} className="flex gap-2">
							<input
								value={comment}
								onChange={(event) => setComment(event.target.value)}
								maxLength={MAX_COMMENT_LENGTH}
								placeholder="Napisz życzenia…"
								aria-label="Komentarz do pokazu"
								className="min-h-12 w-full rounded-full border border-wedding-ivory/25 bg-wedding-green-deep/50 px-5 text-wedding-ivory [outline-color:var(--wedding-ivory)] placeholder:text-wedding-ivory/70 backdrop-blur"
							/>
							<button
								type="submit"
								disabled={!comment.trim()}
								className="min-h-12 shrink-0 rounded-full bg-wedding-ivory px-5 font-bold text-wedding-green transition hover:bg-wedding-cream disabled:opacity-50"
							>
								Wyślij
							</button>
						</form>
					</div>
				</footer>
			) : null}
		</main>
	);
}
