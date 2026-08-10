"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useMemo, useState } from "react";
import { ChevronLeftIcon } from "@/components/slideshow/icons";
import { useSlideshowLive } from "@/components/slideshow/use-slideshow-live";
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

async function readError(response: Response, fallback: string) {
	const body = (await response.json().catch(() => null)) as {
		error?: string;
	} | null;
	return body?.error ?? fallback;
}

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
				error instanceof Error ? error.message : "Coś poszło nie tak.",
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
		<main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-10">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="text-sm font-bold uppercase tracking-[0.25em]">
						Panel pary młodej
					</p>
					<h1 className="mt-2 font-serif text-5xl font-bold">Pokaz slajdów</h1>
					<p className="mt-3 max-w-2xl">
						Ułóż wieczorny pokaz ze zdjęć galerii i slajdów z tekstem. Bez
						własnej listy pokaz gra wszystkie zatwierdzone zdjęcia
						chronologicznie. Kolejność zmienisz przeciągając slajdy lub
						strzałkami.
					</p>
				</div>
				<div className="flex gap-2">
					<Link
						href="/admin"
						className="flex min-h-11 items-center gap-1.5 rounded-full border border-wedding-green px-5 py-2.5 font-bold hover:bg-wedding-rose/40"
					>
						<ChevronLeftIcon />
						Zdjęcia
					</Link>
					<Link
						href="/pokaz"
						className="min-h-11 rounded-full bg-wedding-green px-5 py-2.5 font-bold text-wedding-rose hover:bg-wedding-green-soft"
					>
						Zobacz pokaz
					</Link>
				</div>
			</header>

			{message ? (
				<p role="alert" className="mt-6 font-bold text-wedding-error">
					{message}
				</p>
			) : null}
			{notice ? (
				<p aria-live="polite" className="mt-6 font-bold text-wedding-success">
					{notice}
				</p>
			) : null}

			<section aria-labelledby="timing-title" className="mt-10">
				<h2 id="timing-title" className="font-serif text-3xl font-bold">
					Tempo pokazu
				</h2>
				<div className="mt-4 flex flex-wrap items-center gap-3 rounded-3xl bg-wedding-cream p-5">
					<label htmlFor="slide-seconds" className="font-semibold">
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
						className="min-h-12 w-24 rounded-2xl border-2 border-wedding-green bg-white px-4 text-center text-lg font-bold tabular-nums"
					/>
					<span className="font-semibold">sekund</span>
					{secondsSaved ? (
						<span
							aria-live="polite"
							className="text-sm font-bold text-wedding-success"
						>
							Zapisano
						</span>
					) : null}
					<p className="w-full text-sm">
						Od {SLIDESHOW_MIN_SECONDS} do {SLIDESHOW_MAX_SECONDS} sekund.
						{live.status === "on"
							? " Zmiana działa od razu na wszystkich otwartych ekranach."
							: " Zapisane tempo włączy się przy otwarciu pokazu."}
					</p>
				</div>
			</section>

			<section aria-labelledby="slides-title" className="mt-10">
				<h2 id="slides-title" className="font-serif text-3xl font-bold">
					Slajdy ({slides.length})
				</h2>
				{slides.length === 0 ? (
					<p className="mt-4 rounded-[2rem] border border-dashed border-wedding-green/50 p-8 text-center">
						Lista jest pusta — pokaz gra teraz automatycznie z galerii. Dodaj
						pierwszy slajd, aby ułożyć własną historię.
					</p>
				) : (
					<ol className="mt-5 grid gap-3">
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

			<section aria-labelledby="add-text-title" className="mt-12">
				<h2 id="add-text-title" className="font-serif text-3xl font-bold">
					Dodaj slajd z tekstem
				</h2>
				<form
					onSubmit={addTextSlide}
					className="mt-5 grid max-w-xl gap-3 rounded-3xl bg-wedding-cream p-5"
				>
					<label htmlFor="text-slide-title" className="font-semibold">
						Tytuł
					</label>
					<input
						id="text-slide-title"
						value={textTitle}
						onChange={(event) => setTextTitle(event.target.value)}
						required
						maxLength={SLIDESHOW_MAX_TITLE}
						placeholder="Dziękujemy, że jesteście z nami!"
						className="min-h-12 rounded-2xl border-2 border-wedding-green bg-white px-4"
					/>
					<label htmlFor="text-slide-subtitle" className="font-semibold">
						Podtytuł (opcjonalnie)
					</label>
					<input
						id="text-slide-subtitle"
						value={textSubtitle}
						onChange={(event) => setTextSubtitle(event.target.value)}
						maxLength={SLIDESHOW_MAX_SUBTITLE}
						placeholder="Paweł i Magdalena"
						className="min-h-12 rounded-2xl border-2 border-wedding-green/50 bg-white px-4"
					/>
					<button
						type="submit"
						disabled={pending || !textTitle.trim()}
						className="min-h-12 rounded-full bg-wedding-green px-6 font-bold text-wedding-rose hover:bg-wedding-green-soft disabled:opacity-50"
					>
						Dodaj slajd
					</button>
				</form>
			</section>
		</main>
	);
}
