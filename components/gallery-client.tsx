"use client";

import { useCallback, useState } from "react";
import {
	type GalleryResponse,
	useGalleryFeed,
} from "@/components/gallery/gallery-feed";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { PhotoLightbox } from "@/components/gallery/photo-lightbox";
import { UploadPanel } from "@/components/upload-panel";
import type { GalleryItem } from "@/lib/domain";
import { formatGalleryStats } from "@/lib/i18n";

export function GalleryClient({ initial }: { initial: GalleryResponse }) {
	const [selected, setSelected] = useState<GalleryItem | null>(null);
	const { items, stats, cursor, pending, message, refresh, loadMore } =
		useGalleryFeed(initial);
	const closeLightbox = useCallback(() => setSelected(null), []);

	return (
		<>
			<main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
				<header className="grid gap-6 py-8 text-center">
					<p className="text-sm font-bold uppercase tracking-[0.3em]">
						Wspomnienia z naszego dnia
					</p>
					<h1 className="font-serif text-5xl font-bold sm:text-7xl">
						Paweł & Magdalena
					</h1>
					<p className="mx-auto max-w-2xl text-lg leading-8">
						Dziękujemy, że świętujecie razem z nami. Dodajcie swoje kadry i
						zobaczcie ten dzień oczami wszystkich gości.
					</p>
					<p className="font-bold" aria-live="polite">
						{formatGalleryStats(stats.contributingGuests, stats.approvedPhotos)}
					</p>
				</header>

				<div className="mx-auto mb-10 max-w-2xl">
					<UploadPanel onComplete={refresh} />
				</div>

				<GalleryGrid
					items={items}
					hasMore={Boolean(cursor)}
					pending={pending}
					message={message}
					onRefresh={refresh}
					onLoadMore={loadMore}
					onSelect={setSelected}
				/>
			</main>
			<PhotoLightbox item={selected} onClose={closeLightbox} />
		</>
	);
}
