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
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	EyeIcon,
	PauseIcon,
	PlayIcon,
} from "@/components/slideshow/icons";
import { usePresenterSync } from "@/components/slideshow/use-presenter-sync";
import { useSlideshowLive } from "@/components/slideshow/use-slideshow-live";
import type {
	SlideshowDeck,
	SlideshowJoinInfo,
	SlideshowSlide,
} from "@/lib/slideshow";
import {
	MAX_COMMENT_LENGTH,
	REACTION_EMOJI,
	SLIDESHOW_DEFAULT_SECONDS,
} from "@/lib/slideshow-protocol";

const SLIDE_EXIT_MS = 260;
const SWIPE_THRESHOLD_PX = 48;

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
				<div className="grid h-full place-items-center px-8">
					<div className="max-w-4xl">
						<p className="font-serif text-[clamp(2.5rem,8vw,6rem)] leading-[0.95] text-balance">
							{slide.title}
						</p>
						{slide.subtitle ? (
							<>
								<hr className="ma-rule mt-8" />
								<p className="mt-8 text-lg text-ma-ash-deep sm:text-2xl">
									{slide.subtitle}
								</p>
							</>
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
				<figcaption className="absolute inset-x-0 bottom-28 px-6 sm:bottom-32">
					<span className="ma-stage-control mx-auto block max-w-3xl text-center font-serif text-2xl text-balance sm:text-3xl">
						{slide.title}
						{slide.subtitle ? (
							<span className="mt-1 block text-base text-ma-ash-deep sm:text-lg">
								{slide.subtitle}
							</span>
						) : null}
					</span>
				</figcaption>
			) : null}
		</figure>
	);
}

export function SlideshowClient({
	deck,
	join = null,
	slideSeconds = SLIDESHOW_DEFAULT_SECONDS,
}: {
	deck: SlideshowDeck;
	join?: SlideshowJoinInfo | null;
	slideSeconds?: number;
}) {
	const { slides } = deck;
	const [index, setIndex] = useState(0);
	const [previousIndex, setPreviousIndex] = useState<number | null>(null);
	const [playing, setPlaying] = useState(true);
	const [comment, setComment] = useState("");
	const pointerStart = useRef<{ x: number; y: number } | null>(null);
	const live = useSlideshowLive();

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

	const sync = usePresenterSync({
		live,
		slides,
		index,
		playing,
		goTo,
		fallbackSeconds: slideSeconds,
	});
	// Local autoplay runs whenever this device owns its own timeline.
	const autoplaying = playing && !sync.following;

	const navigate = useCallback(
		(target: number) => {
			if (sync.following) sync.detach();
			goTo(target);
		},
		[sync.following, sync.detach, goTo],
	);

	useEffect(() => {
		if (previousIndex === null) return;
		const timer = setTimeout(() => setPreviousIndex(null), SLIDE_EXIT_MS);
		return () => clearTimeout(timer);
	}, [previousIndex]);

	useEffect(() => {
		if (!autoplaying || slides.length < 2) return;
		const timer = setTimeout(() => goTo(index + 1), sync.slideMs);
		return () => clearTimeout(timer);
	}, [autoplaying, index, slides.length, goTo, sync.slideMs]);

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
		if ((!playing && !sync.following) || !("wakeLock" in navigator)) return;
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
	}, [playing, sync.following]);

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
			<main className="ma-stage relative grid min-h-dvh place-items-center px-6">
				<div className="max-w-xl">
					<h1 className="font-serif text-[clamp(2.5rem,8vw,5rem)] leading-[0.95]">
						Pokaz slajdów
					</h1>
					<hr className="ma-rule mt-8" />
					<p className="mt-8 text-lg text-ma-ash-deep">
						Ułoży się sam z zatwierdzonych zdjęć galerii.
					</p>
					<Link href="/" className="ma-stage-action mt-10">
						Wróć do galerii
					</Link>
				</div>
				{join ? (
					<aside className="absolute bottom-6 left-6 hidden bg-ma-plaster p-2 xl:block">
						<Image
							src={join.qrDataUrl}
							alt="Kod QR dołączenia do pokazu"
							width={112}
							height={112}
							unoptimized
							className="size-28"
						/>
					</aside>
				) : null}
			</main>
		);
	}

	const currentSlide = slides[index];
	const previousSlide = previousIndex === null ? null : slides[previousIndex];

	return (
		<main
			className="ma-stage relative h-dvh w-full touch-pan-y select-none overflow-hidden"
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
					className="ma-slide-exit z-0"
				/>
			) : null}
			<SlideView
				key={`slide-${index}`}
				slide={currentSlide}
				className="ma-slide-enter z-10"
			/>

			<BubbleLayer bubbles={live.bubbles} onDone={live.dismissBubble} />

			<p aria-live="polite" className="sr-only">
				{live.lastComment}
			</p>

			<header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 p-4">
				<div className="flex items-center gap-4">
					<Link
						href="/"
						className="ma-stage-control ma-label flex min-h-11 items-center gap-1.5 text-ma-plaster hover:text-ma-ash-deep"
					>
						<ChevronLeftIcon />
						Galeria
					</Link>
					{live.isLive ? (
						<span className="ma-stage-control ma-label flex min-h-11 items-center gap-2 whitespace-nowrap text-ma-plaster">
							<span
								aria-hidden
								className="size-1.5 animate-pulse bg-ma-plaster"
							/>
							{live.isPresenter ? "Prowadzisz" : "Na żywo"}
						</span>
					) : null}
				</div>
				<div className="flex items-center gap-4">
					{live.status === "on" ? (
						<span
							className="ma-stage-control flex min-h-11 items-center gap-1.5 whitespace-nowrap text-sm tabular-nums"
							title="Liczba oglądających"
						>
							<EyeIcon />
							{live.viewers}
						</span>
					) : null}
					<span className="ma-stage-control ma-numeral flex min-h-11 items-center whitespace-nowrap text-sm">
						{index + 1} / {slides.length}
					</span>
					{sync.canTakeOver ? (
						<button
							type="button"
							onClick={sync.takeBack}
							className="ma-stage-action whitespace-nowrap"
						>
							Przejmij pokaz
						</button>
					) : null}
					{!sync.following ? (
						<button
							type="button"
							onClick={() => setPlaying((value) => !value)}
							aria-label={playing ? "Zatrzymaj pokaz" : "Wznów pokaz"}
							className="ma-stage-control grid min-h-11 min-w-11 place-items-center text-lg hover:text-ma-ash-deep"
						>
							{playing ? <PauseIcon /> : <PlayIcon />}
						</button>
					) : null}
				</div>
			</header>

			<div className="absolute inset-x-0 top-20 z-30 flex flex-col items-center gap-2 px-4">
				{sync.notice ? (
					<p
						aria-live="polite"
						className="bg-ma-plaster px-5 py-2 text-center text-sm font-medium text-ma-ink"
					>
						{sync.notice}
					</p>
				) : null}
				{sync.detached && live.isLive ? (
					<button
						type="button"
						onClick={sync.reattach}
						className="ma-stage-action gap-2"
					>
						<span
							aria-hidden
							className="size-1.5 animate-pulse bg-ma-oxblood"
						/>
						Wróć do pokazu na żywo
					</button>
				) : null}
			</div>

			{slides.length > 1 ? (
				<>
					<button
						type="button"
						onClick={() => navigate(index - 1)}
						aria-label="Poprzedni slajd"
						className="ma-stage-control absolute left-1 top-1/2 z-30 hidden min-h-12 min-w-12 -translate-y-1/2 place-items-center text-xl pointer-coarse:grid"
					>
						<ChevronLeftIcon />
					</button>
					<button
						type="button"
						onClick={() => navigate(index + 1)}
						aria-label="Następny slajd"
						className="ma-stage-control absolute right-1 top-1/2 z-30 hidden min-h-12 min-w-12 -translate-y-1/2 place-items-center text-xl pointer-coarse:grid"
					>
						<ChevronRightIcon />
					</button>
				</>
			) : null}

			{join ? (
				<aside className="absolute bottom-6 left-6 z-30 hidden bg-ma-plaster p-2 xl:block">
					<Image
						src={join.qrDataUrl}
						alt="Kod QR dołączenia do pokazu"
						width={112}
						height={112}
						unoptimized
						className="size-28"
					/>
				</aside>
			) : null}

			{live.status === "on" ? (
				<footer className="absolute inset-x-0 bottom-0 z-30 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
					<div className="mx-auto grid w-full max-w-xl gap-3">
						<div className="flex justify-center gap-2">
							{REACTION_EMOJI.map((emoji) => (
								<button
									key={emoji}
									type="button"
									onClick={() => live.sendReaction(emoji)}
									aria-label={`Wyślij reakcję: ${reactionLabels[emoji] ?? emoji}`}
									className="ma-stage-field grid min-h-12 min-w-12 place-items-center px-0 text-2xl transition active:scale-90"
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
								className="ma-stage-field"
							/>
							<button
								type="submit"
								disabled={!comment.trim()}
								className="ma-stage-action shrink-0"
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
