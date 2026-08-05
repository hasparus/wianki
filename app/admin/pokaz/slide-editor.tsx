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
import type { GalleryItem } from "@/lib/domain";
import type { AdminSlide } from "@/lib/slideshow";

type PickerPage = {
	items: GalleryItem[];
	nextCursor: string | null;
	usedPhotoIds: string[];
};

async function readError(response: Response, fallback: string) {
	const body = (await response.json().catch(() => null)) as {
		error?: string;
	} | null;
	return body?.error ?? fallback;
}

export function SlideEditor({
	initialSlides,
	initialError,
}: {
	initialSlides: AdminSlide[];
	initialError: string;
}) {
	const [slides, setSlides] = useState(initialSlides);
	const [message, setMessage] = useState(initialError);
	const [notice, setNotice] = useState("");
	const [pending, setPending] = useState(false);

	const [pickerOpen, setPickerOpen] = useState(false);
	const [pickerPhotos, setPickerPhotos] = useState<GalleryItem[]>([]);
	const [pickerCursor, setPickerCursor] = useState<string | null>(null);
	const [pickerLoaded, setPickerLoaded] = useState(false);
	const [usedPhotoIds, setUsedPhotoIds] = useState<Set<string>>(new Set());
	const [selection, setSelection] = useState<Set<string>>(new Set());

	const [textTitle, setTextTitle] = useState("");
	const [textSubtitle, setTextSubtitle] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState("");
	const [editSubtitle, setEditSubtitle] = useState("");

	const [dragId, setDragId] = useState<string | null>(null);
	const rowRefs = useRef(new Map<string, HTMLLIElement>());
	const endDragRef = useRef<((commit: boolean) => void) | null>(null);
	// Mirrors `slides` so the drop handler can persist the just-dragged order
	// without waiting for a re-render.
	const slidesRef = useRef(initialSlides);
	slidesRef.current = slides;

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

	function move(from: number, to: number) {
		if (to < 0 || to >= slides.length || from === to) return;
		const next = [...slides];
		const [slide] = next.splice(from, 1);
		next.splice(to, 0, slide);
		setSlides(next);
		void persistOrder(next);
	}

	// Handle-based drag that works with mouse and touch alike. Move/up
	// listeners live on `window`, not on the handle: reordering re-parents the
	// row's DOM node, which would break pointer capture mid-drag.
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
				// Keep the mirror current even if the drop lands before React
				// re-renders this last swap.
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
			if (commit) void persistOrder(slidesRef.current);
		};
		const onUp = () => endDrag(true);
		const onCancel = () => endDrag(false);
		endDragRef.current = endDrag;
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onCancel);
	}

	// Tear down window listeners if the editor unmounts mid-drag.
	useEffect(() => () => endDragRef.current?.(false), []);

	async function loadPickerPage(cursor?: string | null) {
		const url = cursor
			? `/api/admin/slides/photos?cursor=${encodeURIComponent(cursor)}`
			: "/api/admin/slides/photos";
		const response = await fetch(url, { cache: "no-store" });
		if (!response.ok) {
			throw new Error(await readError(response, "Nie udało się pobrać zdjęć."));
		}
		const body = (await response.json()) as PickerPage;
		setPickerPhotos((current) =>
			cursor ? [...current, ...body.items] : body.items,
		);
		setPickerCursor(body.nextCursor);
		setUsedPhotoIds(new Set(body.usedPhotoIds));
		setPickerLoaded(true);
	}

	function togglePicker() {
		const opening = !pickerOpen;
		setPickerOpen(opening);
		if (opening && !pickerLoaded) {
			void run(() => loadPickerPage());
		}
	}

	function toggleSelection(photoId: string) {
		setSelection((current) => {
			const next = new Set(current);
			if (next.has(photoId)) next.delete(photoId);
			else next.add(photoId);
			return next;
		});
	}

	async function addSelectedPhotos() {
		const photoIds = [...selection];
		await run(async () => {
			const response = await fetch("/api/admin/slides", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ photoIds }),
			});
			if (!response.ok) {
				throw new Error(
					await readError(response, "Nie udało się dodać zdjęć."),
				);
			}
			const body = (await response.json()) as {
				added: number;
				skipped: number;
			};
			setSelection(new Set());
			setNotice(
				body.skipped > 0
					? `Dodano ${body.added}, pominięto ${body.skipped} (już w pokazie lub niewidoczne).`
					: `Dodano ${body.added}.`,
			);
			await Promise.all([refresh(), loadPickerPage()]);
		});
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

	function startEditing(slide: AdminSlide) {
		setEditingId(slide.id);
		setEditTitle(slide.title ?? "");
		setEditSubtitle(slide.subtitle ?? "");
	}

	async function saveEditing(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!editingId) return;
		await run(async () => {
			const response = await fetch(`/api/admin/slides/${editingId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: editTitle,
					subtitle: editSubtitle || undefined,
				}),
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
			await Promise.all([refresh(), pickerLoaded ? loadPickerPage() : null]);
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
						className="min-h-11 rounded-full border border-wedding-green px-5 py-2.5 font-bold hover:bg-wedding-rose/40"
					>
						‹ Zdjęcia
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
							<li
								key={slide.id}
								ref={(element) => {
									if (element) rowRefs.current.set(slide.id, element);
									else rowRefs.current.delete(slide.id);
								}}
								className={`flex items-center gap-3 rounded-3xl border bg-wedding-cream p-3 shadow-sm ${
									dragId === slide.id
										? "relative z-10 scale-[1.01] border-wedding-green shadow-lg"
										: "border-wedding-rose"
								}`}
							>
								<span
									aria-hidden
									onPointerDown={(event) => onDragStart(event, slide.id)}
									className="shrink-0 cursor-grab touch-none select-none px-1.5 py-3 text-xl leading-none text-wedding-green/60 active:cursor-grabbing"
								>
									⠿
								</span>
								<span className="w-6 shrink-0 text-center font-serif text-xl font-bold">
									{index + 1}
								</span>
								{slide.kind === "photo" ? (
									slide.imageUrl ? (
										<Image
											src={slide.imageUrl}
											alt=""
											width={160}
											height={120}
											unoptimized
											draggable={false}
											className="h-16 w-20 shrink-0 rounded-2xl object-cover sm:h-20 sm:w-28"
										/>
									) : (
										<div className="grid h-16 w-20 shrink-0 place-items-center rounded-2xl bg-wedding-rose/30 px-2 text-center text-xs font-bold sm:h-20 sm:w-28">
											Zdjęcie ukryte
										</div>
									)
								) : (
									<div className="grid h-16 w-20 shrink-0 place-items-center rounded-2xl bg-wedding-green px-2 text-center sm:h-20 sm:w-28">
										<span className="font-serif text-xs font-bold text-wedding-ivory">
											Aa
										</span>
									</div>
								)}
								<div className="min-w-0 flex-1">
									{editingId === slide.id ? (
										<form onSubmit={saveEditing} className="grid gap-2">
											<input
												value={editTitle}
												onChange={(event) => setEditTitle(event.target.value)}
												required
												maxLength={120}
												aria-label="Tytuł slajdu"
												className="min-h-10 w-full rounded-xl border border-wedding-green bg-white px-3"
											/>
											<input
												value={editSubtitle}
												onChange={(event) =>
													setEditSubtitle(event.target.value)
												}
												maxLength={200}
												aria-label="Podtytuł slajdu"
												placeholder="Podtytuł (opcjonalnie)"
												className="min-h-10 w-full rounded-xl border border-wedding-green/50 bg-white px-3"
											/>
											<div className="flex gap-2">
												<button
													type="submit"
													disabled={pending}
													className="min-h-10 rounded-full bg-wedding-green px-4 text-sm font-bold text-wedding-rose disabled:opacity-50"
												>
													Zapisz
												</button>
												<button
													type="button"
													onClick={() => setEditingId(null)}
													className="min-h-10 rounded-full border border-wedding-green px-4 text-sm font-bold"
												>
													Anuluj
												</button>
											</div>
										</form>
									) : (
										<>
											<p className="truncate font-bold">
												{slide.kind === "photo"
													? slide.photoVisible
														? "Zdjęcie z galerii"
														: "Zdjęcie niewidoczne — pominięte w pokazie"
													: slide.title}
											</p>
											{slide.kind === "text" && slide.subtitle ? (
												<p className="truncate text-sm">{slide.subtitle}</p>
											) : null}
											{slide.kind === "text" ? (
												<button
													type="button"
													onClick={() => startEditing(slide)}
													className="mt-1 text-sm font-bold underline underline-offset-4 hover:text-wedding-green-soft"
												>
													Edytuj treść
												</button>
											) : null}
										</>
									)}
								</div>
								<div className="flex shrink-0 flex-col items-center gap-1.5 sm:flex-row">
									<button
										type="button"
										onClick={() => move(index, index - 1)}
										disabled={pending || index === 0}
										aria-label="Przesuń wyżej"
										className="min-h-10 min-w-10 rounded-full border border-wedding-green font-bold hover:bg-wedding-rose/40 disabled:opacity-40"
									>
										↑
									</button>
									<button
										type="button"
										onClick={() => move(index, index + 1)}
										disabled={pending || index === slides.length - 1}
										aria-label="Przesuń niżej"
										className="min-h-10 min-w-10 rounded-full border border-wedding-green font-bold hover:bg-wedding-rose/40 disabled:opacity-40"
									>
										↓
									</button>
									<button
										type="button"
										onClick={() => removeSlide(slide.id)}
										disabled={pending}
										aria-label="Usuń slajd"
										className="min-h-10 min-w-10 rounded-full bg-wedding-error font-bold text-white disabled:opacity-40"
									>
										✕
									</button>
								</div>
							</li>
						))}
					</ol>
				)}
			</section>

			<section aria-labelledby="add-photos-title" className="mt-12">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 id="add-photos-title" className="font-serif text-3xl font-bold">
						Dodaj zdjęcia
					</h2>
					<button
						type="button"
						onClick={togglePicker}
						className="min-h-11 rounded-full border-2 border-wedding-green px-5 font-bold hover:bg-wedding-rose/40"
					>
						{pickerOpen ? "Zwiń wybór zdjęć" : "Wybierz z galerii"}
					</button>
				</div>
				{pickerOpen ? (
					<div className="mt-5">
						{pickerPhotos.length === 0 && pickerLoaded ? (
							<p className="rounded-3xl bg-wedding-cream p-6 text-center">
								W galerii nie ma jeszcze zatwierdzonych zdjęć.
							</p>
						) : (
							<ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
								{pickerPhotos.map((photo) => {
									const used = usedPhotoIds.has(photo.id);
									const selected = selection.has(photo.id);
									return (
										<li key={photo.id}>
											<button
												type="button"
												disabled={used || pending}
												onClick={() => toggleSelection(photo.id)}
												aria-pressed={selected}
												aria-label={
													used
														? "Zdjęcie jest już w pokazie"
														: "Zaznacz zdjęcie do pokazu"
												}
												className={`relative block w-full overflow-hidden rounded-2xl border-4 ${
													selected
														? "border-wedding-green"
														: "border-transparent"
												} ${used ? "opacity-40" : ""}`}
											>
												<Image
													src={photo.imageUrl}
													alt=""
													width={300}
													height={300}
													unoptimized
													className="aspect-square w-full object-cover"
												/>
												{used ? (
													<span className="absolute inset-x-0 bottom-0 bg-wedding-green/90 py-1 text-center text-xs font-bold text-wedding-ivory">
														W pokazie
													</span>
												) : null}
												{selected ? (
													<span className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-wedding-green text-sm font-bold text-wedding-ivory">
														✓
													</span>
												) : null}
											</button>
										</li>
									);
								})}
							</ul>
						)}
						<div className="mt-4 flex flex-wrap items-center gap-3">
							<button
								type="button"
								onClick={addSelectedPhotos}
								disabled={pending || selection.size === 0}
								className="min-h-11 rounded-full bg-wedding-green px-6 font-bold text-wedding-rose hover:bg-wedding-green-soft disabled:opacity-50"
							>
								Dodaj wybrane ({selection.size})
							</button>
							{pickerCursor ? (
								<button
									type="button"
									onClick={() => run(() => loadPickerPage(pickerCursor))}
									disabled={pending}
									className="min-h-11 rounded-full border border-wedding-green px-5 font-bold hover:bg-wedding-rose/40 disabled:opacity-50"
								>
									Pokaż więcej zdjęć
								</button>
							) : null}
						</div>
					</div>
				) : null}
			</section>

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
						maxLength={120}
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
						maxLength={200}
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
