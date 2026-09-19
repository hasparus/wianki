"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type GalleryResponse,
	useGalleryFeed,
} from "@/components/gallery/gallery-feed";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { PhotoLightbox } from "@/components/gallery/photo-lightbox";
import { PhotoChallenge } from "@/components/photo-challenge";
import { UploadPanel } from "@/components/upload-panel";
import type { GalleryItem } from "@/lib/domain";

/**
 * Every photograph has an address. Opening one writes `?p=<id>`, so the link a
 * guest sends opens on the same plate, and the phone's back gesture closes it.
 */
function usePhotoParam() {
	const [photoId, setPhotoId] = useState<string | null>(null);
	const pushedByUs = useRef(false);

	useEffect(() => {
		const read = () => {
			const id = new URLSearchParams(window.location.search).get("p");
			if (!id) pushedByUs.current = false;
			setPhotoId(id);
		};
		read();
		window.addEventListener("popstate", read);
		return () => window.removeEventListener("popstate", read);
	}, []);

	const open = useCallback((id: string) => {
		window.history.pushState(null, "", `?p=${id}`);
		pushedByUs.current = true;
		setPhotoId(id);
	}, []);

	const close = useCallback(() => {
		if (pushedByUs.current) {
			// Walking back is what the guest expects, and popstate clears the id.
			window.history.back();
			return;
		}
		window.history.replaceState(null, "", window.location.pathname);
		setPhotoId(null);
	}, []);

	return { photoId, open, close };
}

export function GalleryClient({ initial }: { initial: GalleryResponse }) {
	const { items, stats, cursor, pending, message, refresh, loadMore } =
		useGalleryFeed(initial);
	const { photoId, open, close } = usePhotoParam();
	const selected = items.find((item) => item.id === photoId) ?? null;
	const selectPhoto = useCallback((item: GalleryItem) => open(item.id), [open]);

	// An addressed photograph may sit past the loaded pages, so walk towards it.
	useEffect(() => {
		if (!photoId || selected || pending || !cursor) return;
		loadMore();
	}, [photoId, selected, pending, cursor, loadMore]);

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
						onSelect={selectPhoto}
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

			<PhotoLightbox item={selected} onClose={close} />
		</>
	);
}
