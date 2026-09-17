import Image from "next/image";
import { useState } from "react";
import { CheckIcon } from "@/components/slideshow/icons";
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
		<section aria-labelledby="add-photos-title" className="mt-16">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h2
						id="add-photos-title"
						className="font-serif text-3xl leading-tight"
					>
						Dodaj zdjęcia
					</h2>
					<hr className="ma-rule mt-4" />
				</div>
				<button
					type="button"
					onClick={toggle}
					className="ma-action ma-action--ghost"
				>
					{open ? "Zwiń wybór zdjęć" : "Wybierz z galerii"}
				</button>
			</div>
			{open ? (
				<div className="mt-8">
					{!loaded ? (
						<p aria-live="polite" className="ma-empty text-ma-pine">
							Wczytujemy zdjęcia z galerii…
						</p>
					) : photos.length === 0 ? (
						<p className="ma-empty text-ma-pine">
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
											className={`relative block w-full overflow-hidden outline-offset-0 ${
												selected ? "outline-3 outline-ma-ink" : "outline-0"
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
												<span className="ma-suiban absolute inset-x-0 bottom-0 py-1 text-center text-[0.625rem] uppercase tracking-[0.2em]">
													W pokazie
												</span>
											) : null}
											{selected ? (
												<span
													aria-hidden
													className="absolute right-0 top-0 grid size-7 place-items-center bg-ma-ink text-sm text-ma-plaster-lit"
												>
													<CheckIcon />
												</span>
											) : null}
										</button>
									</li>
								);
							})}
						</ul>
					)}
					<div className="mt-6 flex flex-wrap items-center gap-3">
						<button
							type="button"
							onClick={addSelected}
							disabled={pending || selection.size === 0}
							className="ma-action"
						>
							Dodaj wybrane ({selection.size})
						</button>
						{cursor ? (
							<button
								type="button"
								onClick={() => run(() => loadPage(cursor))}
								disabled={pending}
								className="ma-action ma-action--ghost"
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
