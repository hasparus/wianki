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
				 * The arrangement: shin the tallest line, soe the middle one, hikae
				 * the short one that comes forward. They sit at different heights and
				 * indents so the emptiness between them is composed rather than left
				 * over, and the upload well — the thing a guest actually came to do —
				 * is the line that reaches the viewer, inside the first viewport.
				 */}
				<header className="relative mx-auto w-full max-w-6xl pb-[7vh] pt-[8vh] sm:pt-[11vh]">
					<span className="ma-marginalia">Galeria</span>

					<h1 className="font-serif text-[clamp(3.25rem,13vw,7.5rem)] leading-[0.92] tracking-[-0.02em]">
						Rosia <span className="text-ma-pine">&amp;</span> Piotrek
					</h1>
					<hr className="ma-rule mt-7" />

					<div className="mt-[5vh] grid gap-8 sm:grid-cols-12 sm:items-end">
						<p className="text-balance text-lg leading-relaxed text-ma-pine sm:col-span-5">
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

					{/* Soe: the upload well, offset right and lower, on the lit plane. */}
					<div className="mt-[6vh] grid sm:grid-cols-12">
						<div className="sm:col-span-8 sm:col-start-5">
							<UploadPanel onComplete={refresh} />
						</div>
					</div>
				</header>
			</main>

			{/* The arrangement rests on its base, not on the edge of the page. */}
			<div className="ma-base" aria-hidden />

			<div className="w-full px-5 sm:px-10 lg:px-16">
				<div className="mx-auto grid w-full max-w-6xl gap-14 py-16 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-20">
					<GalleryGrid
						items={items}
						hasMore={Boolean(cursor)}
						pending={pending}
						message={message}
						onRefresh={refresh}
						onLoadMore={loadMore}
						onSelect={setSelected}
					/>
					<PhotoChallenge />
				</div>
			</div>

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
