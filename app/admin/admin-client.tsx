"use client";

import Image from "next/image";
import { useState } from "react";
import type { AdminPhotoPage } from "@/lib/admin";

type AdminAction =
	| "approve"
	| "hide"
	| "retry_moderation"
	| "reconcile_archive";

const labels: Record<AdminAction, string> = {
	approve: "Zatwierdź i pokaż",
	hide: "Ukryj z galerii",
	retry_moderation: "Sprawdź ponownie",
	reconcile_archive: "Znajdź w archiwum",
};

/**
 * R2 removal is immediate and final; Drive keeps a trashed file recoverable
 * for 30 days. The warning has to say which one the couple is about to do.
 */
const deleteWarning: Record<"r2" | "drive", string> = {
	r2: "Usunąć kopię galeryjną i trwale skasować oryginał z archiwum? Tego nie da się cofnąć. W bazie pozostanie zapis potrzebny do audytu i ponowienia częściowo nieudanego usuwania.",
	drive:
		"Usunąć kopię galeryjną i przenieść oryginał do kosza Drive? Kosz Drive przechowa go jeszcze przez 30 dni. W bazie pozostanie zapis potrzebny do audytu i ponowienia częściowo nieudanego usuwania.",
};

export function AdminClient({
	initial,
	archiveBackend,
}: {
	initial: AdminPhotoPage;
	archiveBackend: "r2" | "drive";
}) {
	const [photos, setPhotos] = useState(initial.photos);
	const [nextCursor, setNextCursor] = useState(initial.nextCursor);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [message, setMessage] = useState("");

	async function refresh() {
		const response = await fetch("/api/admin/photos", { cache: "no-store" });
		const body = (await response.json()) as Partial<AdminPhotoPage> & {
			error?: string;
		};
		if (!response.ok || !body.photos) {
			throw new Error(body.error ?? "Błąd listy zdjęć.");
		}
		setPhotos(body.photos);
		setNextCursor(body.nextCursor ?? null);
	}

	async function loadMore() {
		if (!nextCursor || isLoadingMore) return;
		setIsLoadingMore(true);
		setMessage("");
		try {
			const response = await fetch(
				`/api/admin/photos?cursor=${encodeURIComponent(nextCursor)}`,
				{ cache: "no-store" },
			);
			const body = (await response.json()) as Partial<AdminPhotoPage> & {
				error?: string;
			};
			if (!response.ok || !body.photos) {
				throw new Error(body.error ?? "Nie udało się pobrać kolejnych zdjęć.");
			}
			const olderPhotos = body.photos;
			setPhotos((current) => [...current, ...olderPhotos]);
			setNextCursor(body.nextCursor ?? null);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Błąd listy zdjęć.");
		} finally {
			setIsLoadingMore(false);
		}
	}

	async function act(photoId: string, action: AdminAction) {
		setPendingId(photoId);
		setMessage("");
		try {
			const response = await fetch(`/api/admin/photos/${photoId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action }),
			});
			const body = (await response.json()) as { error?: string };
			if (!response.ok)
				throw new Error(body.error ?? "Akcja nie powiodła się.");
			await refresh();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Błąd działania.");
		} finally {
			setPendingId(null);
		}
	}

	async function remove(photoId: string) {
		if (!window.confirm(deleteWarning[archiveBackend])) {
			return;
		}
		setPendingId(photoId);
		setMessage("");
		try {
			const response = await fetch(`/api/admin/photos/${photoId}`, {
				method: "DELETE",
			});
			const body = (await response.json()) as {
				error?: string;
				errors?: string[];
			};
			if (!response.ok)
				throw new Error(body.error ?? "Usuwanie nie powiodło się.");
			if (body.errors?.length) setMessage(body.errors.join(" "));
			await refresh();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Błąd usuwania.");
		} finally {
			setPendingId(null);
		}
	}

	return (
		<main className="relative mx-auto w-full max-w-6xl px-5 py-16 sm:px-10">
			<span className="ma-marginalia">Panel</span>
			<header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
				<div>
					<h1 className="font-serif text-[clamp(2.75rem,9vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">
						Wszystkie zdjęcia
					</h1>
					<hr className="ma-rule mt-6" />
					<p className="mt-8 max-w-xl leading-relaxed text-ma-pine">
						W panelu są zdjęcia widoczne, ukryte, oznaczone i wymagające
						reakcji. Ukrycie wycofuje zdjęcie z galerii bez usuwania jego kopii.
						Kod QR administratora działa jak wspólne hasło — nie udostępniaj go
						gościom.
					</p>
				</div>
				<a href="/admin/pokaz" className="ma-action ma-action--ghost">
					Ułóż pokaz slajdów
				</a>
			</header>

			{message ? (
				<p role="alert" className="mt-10 font-medium text-ma-oxblood">
					{message}
				</p>
			) : null}

			{photos.length ? (
				<ul className="mt-14 grid gap-px border border-ma-ash bg-ma-ash sm:grid-cols-2 lg:grid-cols-3">
					{photos.map((photo) => {
						const visible =
							photo.hotStatus === "uploaded" &&
							photo.moderationStatus === "approved";
						return (
							<li key={photo.id} className="bg-ma-plaster-lit">
								{photo.imageUrl ? (
									<Image
										src={photo.imageUrl}
										alt=""
										width={800}
										height={600}
										unoptimized
										className={`aspect-[4/3] w-full object-cover ${
											visible ? "" : "opacity-45"
										}`}
									/>
								) : (
									<div className="grid aspect-[4/3] place-items-center bg-ma-ash text-sm text-ma-pine">
										Brak kopii galeryjnej
									</div>
								)}
								<div className="p-5">
									<p className="truncate text-sm">{photo.originalFilename}</p>
									<p className="ma-label mt-3 text-ma-ink">
										{visible ? "Widoczne w galerii" : "Niewidoczne w galerii"}
									</p>
									<dl className="mt-4 grid grid-cols-[6rem_minmax(0,1fr)] gap-y-1 border-t border-ma-ash pt-4 text-sm">
										<dt className="ma-label">Galeria</dt>
										<dd className="tabular-nums">{photo.hotStatus}</dd>
										<dt className="ma-label">Archiwum</dt>
										<dd className="tabular-nums">{photo.archiveStatus}</dd>
										<dt className="ma-label">Moderacja</dt>
										<dd className="tabular-nums">{photo.moderationStatus}</dd>
									</dl>
									{photo.lastError ? (
										<p className="mt-3 text-sm text-ma-oxblood">
											{photo.lastError}
										</p>
									) : null}
									<div className="mt-5 flex flex-wrap gap-2">
										{photo.hotStatus === "uploaded" ? (
											<button
												type="button"
												disabled={pendingId === photo.id}
												onClick={() =>
													act(
														photo.id,
														photo.moderationStatus === "approved"
															? "hide"
															: "approve",
													)
												}
												className="ma-action ma-action--ghost min-h-11 px-4 text-[0.6875rem]"
											>
												{photo.moderationStatus === "approved"
													? labels.hide
													: labels.approve}
											</button>
										) : null}
										{["flagged", "review_required"].includes(
											photo.moderationStatus,
										) && photo.hotStatus === "uploaded" ? (
											<button
												type="button"
												disabled={pendingId === photo.id}
												onClick={() => act(photo.id, "retry_moderation")}
												className="ma-action ma-action--ghost min-h-11 px-4 text-[0.6875rem]"
											>
												{labels.retry_moderation}
											</button>
										) : null}
										{["pending", "failed"].includes(photo.archiveStatus) ? (
											<button
												type="button"
												disabled={pendingId === photo.id}
												onClick={() => act(photo.id, "reconcile_archive")}
												className="ma-action ma-action--ghost min-h-11 px-4 text-[0.6875rem]"
											>
												{labels.reconcile_archive}
											</button>
										) : null}
										{photo.hotStatus !== "deleted" ||
										photo.archiveStatus !== "trashed" ? (
											<button
												type="button"
												disabled={pendingId === photo.id}
												onClick={() => remove(photo.id)}
												className="ma-action ma-action--danger min-h-11 px-4 text-[0.6875rem]"
											>
												Usuń kopie
											</button>
										) : (
											<p className="ma-label py-3">Usunięto kopie</p>
										)}
									</div>
								</div>
							</li>
						);
					})}
				</ul>
			) : (
				<div className="ma-empty mt-14">
					<div className="max-w-md">
						<p className="font-serif text-3xl leading-tight">
							Nie ma jeszcze żadnych zdjęć.
						</p>
						<hr className="ma-rule mt-6" />
						<p className="mt-6 text-ma-pine">
							Kolejka moderacji zapełni się, gdy goście zaczną wysyłać.
						</p>
					</div>
				</div>
			)}

			{nextCursor ? (
				<div className="mt-12">
					<button
						type="button"
						disabled={isLoadingMore}
						onClick={loadMore}
						className="ma-action ma-action--ghost"
					>
						{isLoadingMore ? "Pobieranie…" : "Pokaż starsze zdjęcia"}
					</button>
				</div>
			) : null}
		</main>
	);
}
