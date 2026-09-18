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
				<header className="relative mx-auto w-full max-w-6xl pb-[6vh] pt-[5vh] sm:pb-[7vh] sm:pt-[11vh]">
					<h1 className="font-serif text-[clamp(3.25rem,13vw,7.5rem)] leading-[0.92] tracking-[-0.02em]">
						Rosia <span className="text-ma-pine">&amp;</span> Piotrek
					</h1>
					<hr className="ma-rule mt-7" />

					<div className="mt-[4vh] grid gap-7 sm:grid-cols-12">
						<div className="sm:col-span-8">
							<PhotoChallenge />
						</div>
					</div>

					{/* Soe: the upload well, offset right and lower, on the lit plane. */}
					<div className="mt-[4vh] grid sm:mt-[6vh] sm:grid-cols-12">
						<div className="sm:col-span-8 sm:col-start-5">
							<UploadPanel onComplete={refresh} />
						</div>
					</div>
				</header>
			</main>

			{/* The arrangement rests on its base, not on the edge of the page. */}
			<div className="ma-base" aria-hidden />

			<div className="w-full px-5 sm:px-10 lg:px-16">
				<div className="mx-auto w-full max-w-6xl py-16">
					<GalleryGrid
						items={items}
						photoCount={stats.approvedPhotos}
						hasMore={Boolean(cursor)}
						pending={pending}
						message={message}
						onLoadMore={loadMore}
						onSelect={setSelected}
					/>
				</div>
			</div>

			<footer className="ma-suiban px-5 py-8 sm:px-10 lg:px-16">
				<div className="mx-auto w-full max-w-6xl">
					<nav className="flex flex-wrap gap-x-8 gap-y-2">
						<Link
							href="/pokaz"
							className="ma-label underline decoration-ma-ash-deep hover:text-ma-plaster"
						>
							Pokaz slajdów
						</Link>
						<Link
							href="/privacy"
							className="ma-label underline decoration-ma-ash-deep hover:text-ma-plaster"
						>
							Informacja o prywatności
						</Link>
					</nav>
				</div>
			</footer>

			<PhotoLightbox item={selected} onClose={closeLightbox} />
		</>
	);
}
