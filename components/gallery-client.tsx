"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
	type GalleryResponse,
	useGalleryFeed,
} from "@/components/gallery/gallery-feed";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { PhotoLightbox } from "@/components/gallery/photo-lightbox";
import { PhotoChallenge } from "@/components/photo-challenge";
import { UploadPanel } from "@/components/upload-panel";
import type { GalleryItem } from "@/lib/domain";
import { formatGalleryStats, guestCountNoun, photoCountNoun } from "@/lib/i18n";

export function GalleryClient({ initial }: { initial: GalleryResponse }) {
	const [selected, setSelected] = useState<GalleryItem | null>(null);
	const { items, stats, cursor, pending, message, refresh, loadMore } =
		useGalleryFeed(initial);
	const closeLightbox = useCallback(() => setSelected(null), []);

	return (
		<>
			<main className="w-full grow px-5 sm:px-10 lg:px-16">
				{/*
				 * Shin, soe, hikae. The three lines sit at different heights and
				 * indents so the void between them is composed rather than left
				 * over; the arrangement itself starts below the fold.
				 */}
				<header className="relative mx-auto w-full max-w-6xl pb-[9vh] pt-[8vh] sm:pb-[11vh] sm:pt-[12vh]">
					<span className="ma-marginalia">Galeria</span>

					{/* Shin: the tallest line, flush to the left margin. */}
					<h1 className="font-serif text-[clamp(3.25rem,13vw,7.5rem)] leading-[0.92] tracking-[-0.02em]">
						Rosia <span className="text-ma-pine">&amp;</span> Piotrek
					</h1>
					<hr className="ma-rule mt-7" />

					{/* Soe: the middle line, stepped in, the void kept open to its left. */}
					<div className="mt-[7vh] grid gap-10 sm:grid-cols-12 sm:items-end sm:gap-8">
						<p className="text-balance text-lg leading-relaxed text-ma-pine sm:col-span-5 sm:col-start-4">
							Dziękujemy, że świętujecie razem z nami. Wrzućcie swoje zdjęcia i
							zobaczcie, co uchwycili inni goście.
						</p>
						{/*
						 * Struck facts: the numeral leads, the declined noun labels it.
						 * Screen readers get the whole sentence instead of two bare
						 * numbers.
						 */}
						<div className="sm:col-span-3 sm:col-start-10">
							<dl className="flex gap-10 sm:justify-end" aria-hidden>
								<div>
									<dd className="ma-numeral text-5xl sm:text-6xl">
										{stats.approvedPhotos}
									</dd>
									<dt className="ma-label mt-3">
										{photoCountNoun(stats.approvedPhotos)}
									</dt>
								</div>
								<div>
									<dd className="ma-numeral text-5xl sm:text-6xl">
										{stats.contributingGuests}
									</dd>
									<dt className="ma-label mt-3">
										{guestCountNoun(stats.contributingGuests)}
									</dt>
								</div>
							</dl>
							<p className="sr-only" aria-live="polite">
								{formatGalleryStats(
									stats.contributingGuests,
									stats.approvedPhotos,
								)}
							</p>
						</div>
					</div>

					{/* Hikae: the short line that comes forward — the primary action. */}
					<div className="mt-[5vh] grid sm:grid-cols-12">
						<div className="flex flex-col gap-3 sm:col-span-6 sm:col-start-4 sm:flex-row">
							<a href="#dodaj" className="ma-action">
								Dodaj zdjęcia
							</a>
							<Link href="/pokaz" className="ma-action ma-action--ghost">
								Pokaz slajdów
							</Link>
						</div>
					</div>
				</header>

				<hr className="ma-rule--wide mx-auto max-w-6xl border-0" />

				<div className="mx-auto grid w-full max-w-6xl gap-16 py-16 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-20">
					<UploadPanel onComplete={refresh} />
					<PhotoChallenge />
				</div>

				<div className="mx-auto w-full max-w-6xl pb-24">
					<GalleryGrid
						items={items}
						hasMore={Boolean(cursor)}
						pending={pending}
						message={message}
						onRefresh={refresh}
						onLoadMore={loadMore}
						onSelect={setSelected}
					/>
				</div>
			</main>

			<footer className="ma-suiban px-5 py-10 sm:px-10 lg:px-16">
				<div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4">
					<p className="font-serif text-2xl">Rosia &amp; Piotrek</p>
					<Link
						href="/privacy"
						className="ma-label underline decoration-ma-ash-deep hover:text-ma-plaster"
					>
						Informacja o prywatności
					</Link>
				</div>
			</footer>

			<PhotoLightbox item={selected} onClose={closeLightbox} />
		</>
	);
}
