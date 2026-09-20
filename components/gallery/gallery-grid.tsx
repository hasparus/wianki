import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import type { Rect } from "@/components/gallery/grid-layout";
import { useZoomableGrid } from "@/components/gallery/use-zoomable-grid";
import {
	ArrowRightIcon,
	MinusIcon,
	PlusIcon,
} from "@/components/slideshow/icons";
import type { GalleryItem } from "@/lib/domain";
import { photoCountNoun } from "@/lib/i18n";

type GalleryGridProps = {
	items: GalleryItem[];
	photoCount: number;
	hasMore: boolean;
	pending: boolean;
	message: string;
	onLoadMore: () => void;
	onSelect: (item: GalleryItem) => void;
};

type PlateProps = {
	item: GalleryItem;
	index: number;
	rect: Rect | null;
	onSelect: (item: GalleryItem) => void;
	register: (id: string, index: number, element: HTMLElement | null) => void;
};

/**
 * One photograph. Before the grid is measured (server render, first paint)
 * it sits in a CSS grid; once measured it is placed absolutely so the grid
 * can be virtualised and animated between zoom levels.
 */
const Plate = memo(function Plate({
	item,
	index,
	rect,
	onSelect,
	register,
}: PlateProps) {
	return (
		<li
			ref={(element) => register(item.id, index, element)}
			data-photo-id={item.id}
			className={
				rect ? "absolute left-0 top-0 origin-top-left" : "aspect-square"
			}
			style={
				rect
					? { left: rect.x, top: rect.y, width: rect.w, height: rect.h }
					: undefined
			}
		>
			<button
				type="button"
				onClick={() => onSelect(item)}
				className="group relative block h-full w-full overflow-hidden bg-ma-ash/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ma-ink"
				aria-label="Powiększ zdjęcie"
			>
				<Image
					src={item.imageUrl}
					alt=""
					fill
					sizes="(max-width: 640px) 34vw, (max-width: 1024px) 34vw, 300px"
					unoptimized
					draggable={false}
					placeholder={item.blurDataUrl ? "blur" : "empty"}
					blurDataURL={item.blurDataUrl ?? undefined}
					className="object-cover group-hover:opacity-85"
				/>
			</button>
		</li>
	);
});

export function GalleryGrid({
	items,
	photoCount,
	hasMore,
	pending,
	message,
	onLoadMore,
	onSelect,
}: GalleryGridProps) {
	const grid = useZoomableGrid({ items, hasMore, pending, onLoadMore });
	const { layout, measured } = grid;
	// Until measured, the first rows render in a plain grid so the server
	// paints something; afterwards only the plates around the viewport exist.
	const [start, end] = measured ? grid.range : [0, Math.min(items.length, 12)];
	const plates = [];
	for (let i = start; i < end; i++) {
		plates.push(
			<Plate
				key={items[i].id}
				item={items[i]}
				index={i}
				rect={measured ? layout.rects[i] : null}
				onSelect={onSelect}
				register={grid.register}
			/>,
		);
	}

	return (
		<section aria-labelledby="gallery-title">
			<h2 id="gallery-title" className="sr-only">
				Galeria
			</h2>
			<div className="flex flex-wrap items-center justify-between gap-3">
				{/* The count stands to the left of the way out of the page. */}
				<p className="flex items-baseline gap-2" aria-live="polite">
					<span className="ma-numeral text-3xl">{photoCount}</span>
					<span className="ma-label">{photoCountNoun(photoCount)}</span>
				</p>
				<div className="flex items-center gap-3">
					{items.length ? (
						<fieldset className="flex">
							<legend className="sr-only">Wielkość zdjęć w galerii</legend>
							<button
								type="button"
								onClick={grid.zoomOut}
								disabled={!grid.canZoomOut}
								className="ma-action ma-action--ghost ma-action--icon"
								aria-label="Mniejsze zdjęcia"
							>
								<MinusIcon />
							</button>
							<button
								type="button"
								onClick={grid.zoomIn}
								disabled={!grid.canZoomIn}
								className="ma-action ma-action--ghost ma-action--icon -ml-px"
								aria-label="Większe zdjęcia"
							>
								<PlusIcon />
							</button>
						</fieldset>
					) : null}
					<Link href="/pokaz" className="ma-action ma-action--ghost">
						Pokaz slajdów
						<ArrowRightIcon />
					</Link>
				</div>
			</div>

			{message && !hasMore ? (
				<p role="alert" className="mt-8 font-medium text-ma-oxblood">
					{message}
				</p>
			) : null}

			{items.length ? (
				<ul
					ref={grid.containerRef}
					className={
						measured
							? "relative mt-12 w-full [overflow-anchor:none] [touch-action:pan-y]"
							: "mt-12 grid w-full grid-cols-3 gap-0.5 lg:grid-cols-4 [touch-action:pan-y]"
					}
					style={measured ? { height: layout.height } : undefined}
				>
					{plates}
				</ul>
			) : (
				<div className="ma-empty mt-12">
					<p className="font-serif text-3xl leading-tight">
						Jeszcze nikt nic nie wrzucił.
					</p>
				</div>
			)}

			{hasMore ? (
				<div
					className="mt-10 flex min-h-12 flex-wrap items-center gap-4"
					aria-live="polite"
				>
					{message ? (
						<>
							<p role="alert" className="font-medium text-ma-oxblood">
								{message}
							</p>
							<button
								type="button"
								onClick={onLoadMore}
								disabled={pending}
								className="ma-action ma-action--ghost"
							>
								Spróbuj ponownie
							</button>
						</>
					) : pending ? (
						<p className="ma-label">Wczytywanie…</p>
					) : null}
				</div>
			) : null}
		</section>
	);
}
