import Image from "next/image";
import { useState } from "react";
import type { GalleryItem } from "@/lib/domain";
import { readError } from "@/lib/http-client";

/**
 * Picks approved gallery photos to append to the deck. Which photos are
 * already in the show is read off the deck the editor holds, so the picker
 * never has to refetch after a slide is added or removed.
 */
export function PhotoPicker({
	usedPhotoIds,
	pending,
	run,
	onAdded,
}: {
	usedPhotoIds: Set<string>;
	pending: boolean;
	run: (work: () => Promise<void>) => Promise<void>;
	onAdded: (added: number, skipped: number) => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	const [photos, setPhotos] = useState<GalleryItem[]>([]);
	const [cursor, setCursor] = useState<string | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [selection, setSelection] = useState<Set<string>>(new Set());

	async function loadPage(from?: string | null) {
		const url = from
			? `/api/admin/slides/photos?cursor=${encodeURIComponent(from)}`
			: "/api/admin/slides/photos";
		const response = await fetch(url, { cache: "no-store" });
		if (!response.ok) {
			throw new Error(await readError(response, "Nie udało się pobrać zdjęć."));
		}
		const body = (await response.json()) as {
			items: GalleryItem[];
			nextCursor: string | null;
		};
		setPhotos((current) => (from ? [...current, ...body.items] : body.items));
		setCursor(body.nextCursor);
		setLoaded(true);
	}

	function toggle() {
		const opening = !open;
		setOpen(opening);
		if (opening && !loaded) void run(() => loadPage());
	}

	function toggleSelection(photoId: string) {
		setSelection((current) => {
			const next = new Set(current);
			if (next.has(photoId)) next.delete(photoId);
			else next.add(photoId);
			return next;
		});
	}

	async function addSelected() {
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
			await onAdded(body.added, body.skipped);
		});
	}

	return (
		<section aria-labelledby="add-photos-title" className="mt-12">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 id="add-photos-title" className="font-serif text-3xl font-bold">
					Dodaj zdjęcia
				</h2>
				<button
					type="button"
					onClick={toggle}
					className="min-h-11 rounded-full border-2 border-wedding-green px-5 font-bold hover:bg-wedding-rose/40"
				>
					{open ? "Zwiń wybór zdjęć" : "Wybierz z galerii"}
				</button>
			</div>
			{open ? (
				<div className="mt-5">
					{!loaded ? (
						<p
							aria-live="polite"
							className="rounded-3xl bg-wedding-cream p-6 text-center"
						>
							Wczytujemy zdjęcia z galerii…
						</p>
					) : photos.length === 0 ? (
						<p className="rounded-3xl bg-wedding-cream p-6 text-center">
							W galerii nie ma jeszcze zatwierdzonych zdjęć.
						</p>
					) : (
						<ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
							{photos.map((photo) => {
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
												selected ? "border-wedding-green" : "border-transparent"
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
							onClick={addSelected}
							disabled={pending || selection.size === 0}
							className="min-h-11 rounded-full bg-wedding-green px-6 font-bold text-wedding-rose hover:bg-wedding-green-soft disabled:opacity-50"
						>
							Dodaj wybrane ({selection.size})
						</button>
						{cursor ? (
							<button
								type="button"
								onClick={() => run(() => loadPage(cursor))}
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
	);
}
