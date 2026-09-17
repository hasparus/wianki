"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useMemo, useState } from "react";
import { ChevronLeftIcon } from "@/components/slideshow/icons";
import { useSlideshowLive } from "@/components/slideshow/use-slideshow-live";
import { readError } from "@/lib/http-client";
import type { AdminSlide } from "@/lib/slideshow";
import {
	clampSlideSeconds,
	SLIDESHOW_MAX_SECONDS,
	SLIDESHOW_MAX_SUBTITLE,
	SLIDESHOW_MAX_TITLE,
	SLIDESHOW_MIN_SECONDS,
} from "@/lib/slideshow-protocol";
import { PhotoPicker } from "./photo-picker";
import { SlideRow } from "./slide-row";
import { useSlideReorder } from "./use-slide-reorder";

export function SlideEditor({
	initialSlides,
	initialError,
	initialSlideSeconds,
}: {
	initialSlides: AdminSlide[];
	initialError: string;
	initialSlideSeconds: number;
}) {
	const [slides, setSlides] = useState(initialSlides);
	const [slideSeconds, setSlideSeconds] = useState(initialSlideSeconds);
	const [secondsSaved, setSecondsSaved] = useState(false);
	// The editor joins the room purely to retime it; it never claims the show,
	// so changing tempo here never yanks the projector out of the presenter's
	// hands. Steering stays with whoever has /pokaz open.
	const live = useSlideshowLive();
	const [message, setMessage] = useState(initialError);
	const [notice, setNotice] = useState("");
	const [pending, setPending] = useState(false);
	const [dragId, setDragId] = useState<string | null>(null);

	const [textTitle, setTextTitle] = useState("");
	const [textSubtitle, setTextSubtitle] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);

	const usedPhotoIds = useMemo(
		() =>
			new Set(
				slides.flatMap((slide) => (slide.photoId ? [slide.photoId] : [])),
			),
		[slides],
	);

	const refresh = useCallback(async () => {
		const response = await fetch("/api/admin/slides", { cache: "no-store" });
		if (!response.ok) {
			setMessage(await readError(response, "Nie udało się pobrać slajdów."));
			return;
		}
		const body = (await response.json()) as { slides: AdminSlide[] };
		setSlides(body.slides);
	}, []);

	async function run(work: () => Promise<void>) {
		setPending(true);
		setMessage("");
		setNotice("");
		try {
			await work();
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "Nie udało się. Odśwież stronę i spróbuj ponownie.",
			);
		} finally {
			setPending(false);
		}
	}

	async function persistOrder(order: AdminSlide[]) {
		await run(async () => {
			const response = await fetch("/api/admin/slides", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ order: order.map((slide) => slide.id) }),
			});
			if (!response.ok) {
				await refresh();
				throw new Error(
					await readError(response, "Nie udało się zapisać kolejności."),
				);
			}
		});
	}

	async function saveSeconds(value: number) {
		const next = clampSlideSeconds(value);
		setSlideSeconds(next);
		live.sendControl({ action: "tempo", slideSeconds: next });
		if (next === initialSlideSeconds && secondsSaved) return;
		await run(async () => {
			const response = await fetch("/api/admin/slides/settings", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slideSeconds: next }),
			});
			if (!response.ok) {
				throw new Error(
					await readError(response, "Nie udało się zapisać tempa pokazu."),
				);
			}
			setSecondsSaved(true);
		});
	}

	function move(from: number, to: number) {
		if (to < 0 || to >= slides.length || from === to) return;
		const next = [...slides];
		const [slide] = next.splice(from, 1);
		next.splice(to, 0, slide);
		setSlides(next);
		void persistOrder(next);
	}

	const { onDragStart, registerRow } = useSlideReorder({
		slides,
		setSlides,
		setDragId,
		onDrop: (order) => void persistOrder(order),
	});

	async function announceAdded(added: number, skipped: number) {
		setNotice(
			skipped > 0
				? `Dodano ${added}, pominięto ${skipped} (już w pokazie lub niewidoczne).`
				: `Dodano ${added}.`,
		);
		await refresh();
	}

	async function addTextSlide(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		await run(async () => {
			const response = await fetch("/api/admin/slides", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: textTitle,
					subtitle: textSubtitle || undefined,
				}),
			});
			if (!response.ok) {
				throw new Error(
					await readError(response, "Nie udało się dodać slajdu."),
				);
			}
			setTextTitle("");
			setTextSubtitle("");
			await refresh();
		});
	}

	async function saveEditing(slideId: string, title: string, subtitle: string) {
		await run(async () => {
			const response = await fetch(`/api/admin/slides/${slideId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title, subtitle: subtitle || undefined }),
			});
			if (!response.ok) {
				throw new Error(
					await readError(response, "Nie udało się zapisać slajdu."),
				);
			}
			setEditingId(null);
			await refresh();
		});
	}

	async function removeSlide(slideId: string) {
		await run(async () => {
			const response = await fetch(`/api/admin/slides/${slideId}`, {
				method: "DELETE",
			});
			if (!response.ok) {
				throw new Error(
					await readError(response, "Nie udało się usunąć slajdu."),
				);
			}
			await refresh();
		});
	}

	return (
		<>
			<main className="relative mx-auto w-full max-w-5xl grow px-5 py-16 sm:px-10">
				<span className="ma-marginalia">Pokaz</span>
				<header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
					<div>
						<h1 className="font-serif text-[clamp(2.75rem,9vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">
							Pokaz slajdów
						</h1>
						<hr className="ma-rule mt-6" />
						<p className="mt-8 max-w-xl leading-relaxed text-ma-pine">
							Ułóż wieczorny pokaz ze zdjęć galerii i slajdów z tekstem. Bez
							własnej listy pokaz gra wszystkie zatwierdzone zdjęcia
							chronologicznie. Kolejność zmienisz przeciągając slajdy lub
							strzałkami.
						</p>
					</div>
					<div className="flex flex-wrap gap-3">
						<Link href="/admin" className="ma-action ma-action--ghost gap-1.5">
							<ChevronLeftIcon />
							Zdjęcia
						</Link>
						<Link href="/pokaz" className="ma-action">
							Zobacz pokaz
						</Link>
					</div>
				</header>

				{message ? (
					<p role="alert" className="mt-10 font-medium text-ma-oxblood">
						{message}
					</p>
				) : null}
				{notice ? (
					<p aria-live="polite" className="mt-10 font-medium text-ma-bottle">
						{notice}
					</p>
				) : null}

				<section aria-labelledby="timing-title" className="mt-16">
					<h2 id="timing-title" className="font-serif text-3xl leading-tight">
						Tempo pokazu
					</h2>
					<hr className="ma-rule mt-4" />
					<div className="mt-6 flex flex-wrap items-center gap-4 border-y border-ma-ash py-5">
						<label htmlFor="slide-seconds" className="ma-label">
							Każdy slajd trwa
						</label>
						<input
							id="slide-seconds"
							type="number"
							inputMode="numeric"
							min={SLIDESHOW_MIN_SECONDS}
							max={SLIDESHOW_MAX_SECONDS}
							value={slideSeconds}
							disabled={pending}
							onChange={(event) => {
								setSecondsSaved(false);
								setSlideSeconds(Number(event.target.value));
							}}
							onBlur={(event) => saveSeconds(Number(event.target.value))}
							className="ma-field w-24 text-center text-lg tabular-nums"
						/>
						<span className="ma-label">sekund</span>
						{secondsSaved ? (
							<span
								aria-live="polite"
								className="text-sm font-medium text-ma-bottle"
							>
								Zapisano
							</span>
						) : null}
						<p className="w-full text-sm text-ma-pine">
							Od {SLIDESHOW_MIN_SECONDS} do {SLIDESHOW_MAX_SECONDS} sekund.
							{live.status === "on"
								? " Zmiana działa od razu na wszystkich otwartych ekranach."
								: " Zapisane tempo włączy się przy otwarciu pokazu."}
						</p>
					</div>
				</section>

				<section aria-labelledby="slides-title" className="mt-16">
					<div className="flex items-end justify-between gap-4">
						<div>
							<h2
								id="slides-title"
								className="font-serif text-3xl leading-tight"
							>
								Slajdy
							</h2>
							<hr className="ma-rule mt-4" />
						</div>
						<span className="ma-numeral text-4xl">{slides.length}</span>
					</div>
					{slides.length === 0 ? (
						<div className="ma-empty mt-8">
							<div className="max-w-md">
								<p className="font-serif text-2xl leading-tight">
									Lista jest pusta, więc pokaz gra automatycznie z galerii.
								</p>
								<hr className="ma-rule mt-6" />
								<p className="mt-6 text-ma-pine">
									Dodaj pierwszy slajd, żeby ustawić własną kolejność.
								</p>
							</div>
						</div>
					) : (
						<ol className="mt-8 border-t border-ma-ash">
							{slides.map((slide, index) => (
								<SlideRow
									key={slide.id}
									slide={slide}
									index={index}
									total={slides.length}
									dragging={dragId === slide.id}
									editing={editingId === slide.id}
									pending={pending}
									registerRow={registerRow}
									onDragStart={onDragStart}
									onMove={move}
									onRemove={removeSlide}
									onStartEdit={setEditingId}
									onSaveEdit={saveEditing}
									onCancelEdit={() => setEditingId(null)}
								/>
							))}
						</ol>
					)}
				</section>

				<PhotoPicker
					usedPhotoIds={usedPhotoIds}
					pending={pending}
					run={run}
					onAdded={announceAdded}
				/>

				<section aria-labelledby="add-text-title" className="mt-16">
					<h2 id="add-text-title" className="font-serif text-3xl leading-tight">
						Dodaj slajd z tekstem
					</h2>
					<hr className="ma-rule mt-4" />
					<form onSubmit={addTextSlide} className="mt-6 grid max-w-xl gap-3">
						<label htmlFor="text-slide-title" className="ma-label">
							Tytuł
						</label>
						<input
							id="text-slide-title"
							value={textTitle}
							onChange={(event) => setTextTitle(event.target.value)}
							required
							maxLength={SLIDESHOW_MAX_TITLE}
							placeholder="Dziękujemy, że jesteście z nami!"
							className="ma-field"
						/>
						<label htmlFor="text-slide-subtitle" className="ma-label mt-2">
							Podtytuł (opcjonalnie)
						</label>
						<input
							id="text-slide-subtitle"
							value={textSubtitle}
							onChange={(event) => setTextSubtitle(event.target.value)}
							maxLength={SLIDESHOW_MAX_SUBTITLE}
							placeholder="Rosia i Piotrek"
							className="ma-field"
						/>
						<button
							type="submit"
							disabled={pending || !textTitle.trim()}
							className="ma-action mt-3"
						>
							Dodaj slajd
						</button>
					</form>
				</section>
			</main>
			<div className="ma-base" aria-hidden />
		</>
	);
}
