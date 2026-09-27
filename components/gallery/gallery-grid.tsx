import {
	AnimatePresence,
	motion,
	type Transition,
	useIsPresent,
	useReducedMotion,
} from "motion/react";
import Image from "next/image";
import { memo, useState } from "react";
import {
	type GalleryGeometry,
	type GalleryRows,
	horizontalGalleryLayout,
} from "@/components/gallery/horizontal-gallery";
import { useHorizontalGallery } from "@/components/gallery/use-horizontal-gallery";
import { MinusIcon, PlusIcon } from "@/components/slideshow/icons";
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
	fromEnd: number;
	rows: GalleryRows;
	geometry: GalleryGeometry;
	onSelect: (item: GalleryItem) => void;
};

type GalleryLayerProps = {
	items: GalleryItem[];
	rows: GalleryRows;
	geometry: GalleryGeometry[];
	placeholders: GalleryGeometry[];
	width: number;
	transition: Transition;
	onSelect: (item: GalleryItem) => void;
};

const LAYER_TRANSITION = {
	duration: 0.24,
	ease: [0.22, 1, 0.36, 1],
} satisfies Transition;

const REDUCED_TRANSITION = { duration: 0 } satisfies Transition;

function plateStyle(geometry: GalleryGeometry) {
	return {
		width: geometry.width,
		height: geometry.height,
		transform: `translate3d(${geometry.x}px, ${geometry.y}px, 0)`,
	};
}

const Plate = memo(function Plate({
	item,
	fromEnd,
	rows,
	geometry,
	onSelect,
}: PlateProps) {
	const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
	const sizes =
		rows === 1
			? "(max-width: 640px) 90vw, 34rem"
			: rows === 2
				? "(max-width: 640px) 48vw, 17rem"
				: "(max-width: 640px) 32vw, 11rem";

	return (
		<li
			data-photo-id={item.id}
			data-gallery-from-end={fromEnd}
			data-gallery-x={geometry.x}
			data-gallery-width={geometry.width}
			className="absolute left-0 top-0 [contain:layout_paint]"
			style={plateStyle(geometry)}
		>
			<button
				type="button"
				onClick={() => onSelect(item)}
				className="group relative block h-full w-full overflow-hidden bg-ma-ash/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ma-ink"
				aria-label="Powiększ zdjęcie"
			>
				{item.blurDataUrl ? (
					<span
						aria-hidden
						className="absolute inset-0 scale-110 bg-cover bg-center blur-xl"
						style={{ backgroundImage: `url("${item.blurDataUrl}")` }}
					/>
				) : null}
				<Image
					src={item.imageUrl}
					alt=""
					fill
					sizes={sizes}
					unoptimized
					draggable={false}
					onLoad={() => setLoadedUrl(item.imageUrl)}
					className={`object-cover transition-opacity duration-150 motion-reduce:transition-none ${!item.blurDataUrl || loadedUrl === item.imageUrl ? "opacity-100 group-hover:opacity-85" : "opacity-0"}`}
				/>
			</button>
		</li>
	);
});

/**
 * A photograph the gallery counted but has not fetched yet. It stands in the
 * rail from the first paint, so the guest scrolls through plates rather than
 * off the end; its page fills it with the blur and then the photograph.
 */
const PlaceholderPlate = memo(function PlaceholderPlate({
	fromEnd,
	geometry,
}: {
	fromEnd: number;
	geometry: GalleryGeometry;
}) {
	return (
		<li
			aria-hidden
			data-gallery-from-end={fromEnd}
			data-gallery-x={geometry.x}
			data-gallery-width={geometry.width}
			className="absolute left-0 top-0 bg-ma-ash/40 [contain:strict]"
			style={plateStyle(geometry)}
		/>
	);
});

function GalleryLayer({
	items,
	rows,
	geometry,
	placeholders,
	width,
	transition,
	onSelect,
}: GalleryLayerProps) {
	const isPresent = useIsPresent();
	const total = items.length + placeholders.length;

	return (
		<motion.ul
			data-gallery-layer
			data-gallery-current={isPresent ? "" : undefined}
			data-gallery-width={width}
			aria-hidden={!isPresent}
			inert={!isPresent}
			className={`absolute inset-y-0 left-0 origin-center ${isPresent ? "z-0" : "pointer-events-none z-10"}`}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={transition}
			style={{ width }}
		>
			{items.map((item, index) => {
				const itemGeometry = geometry[index];
				return itemGeometry ? (
					<Plate
						key={item.id}
						item={item}
						fromEnd={total - index}
						rows={rows}
						geometry={itemGeometry}
						onSelect={onSelect}
					/>
				) : null;
			})}
			{placeholders.map((placeholderGeometry, index) => {
				const fromEnd = placeholders.length - index;
				return (
					<PlaceholderPlate
						key={`placeholder-${fromEnd}`}
						fromEnd={fromEnd}
						geometry={placeholderGeometry}
					/>
				);
			})}
		</motion.ul>
	);
}

const iconButtonClass =
	"grid min-h-11 min-w-11 place-items-center bg-transparent text-ma-ink transition-colors duration-150 hover:text-ma-pine focus-visible:outline-2 focus-visible:outline-ma-ink disabled:cursor-not-allowed disabled:text-ma-ash-deep";

export function GalleryGrid({
	items,
	photoCount,
	hasMore,
	pending,
	message,
	onLoadMore,
	onSelect,
}: GalleryGridProps) {
	const reduceMotion = useReducedMotion() ?? false;
	const transition = reduceMotion ? REDUCED_TRANSITION : LAYER_TRANSITION;
	// The count comes with every page, so the rail can stand at full length
	// while its later pages are still on the way.
	const reserved = hasMore ? Math.max(0, photoCount - items.length) : 0;
	const gallery = useHorizontalGallery({
		itemIds: items.map((item) => item.id),
		reserved,
		hasMore,
		pending,
		onLoadMore,
		reduceMotion,
	});
	const layout = horizontalGalleryLayout(
		items,
		gallery.rows,
		gallery.viewportSize.width,
		gallery.viewportSize.height,
		2,
		gallery.slots,
		reserved,
	);

	return (
		<section
			aria-labelledby="gallery-title"
			className="flex h-dvh min-h-0 flex-col pt-8 sm:pt-10"
		>
			<h2 id="gallery-title" className="sr-only">
				Galeria
			</h2>
			{/*
			 * One quiet line: the count on the left, zoom on the right. The
			 * slideshow is reached from the footer, not from above the photographs.
			 */}
			<div className="flex items-center justify-between gap-3">
				<p className="flex items-baseline gap-2" aria-live="polite">
					<span className="ma-numeral text-3xl">{photoCount}</span>
					<span className="ma-label">{photoCountNoun(photoCount)}</span>
				</p>
				{items.length ? (
					<fieldset
						className="-mr-3 flex items-center"
						aria-label="Wielkość zdjęć"
					>
						<legend className="sr-only">Wielkość zdjęć w galerii</legend>
						<button
							type="button"
							onClick={gallery.zoomOut}
							disabled={!gallery.canZoomOut}
							className={iconButtonClass}
							aria-label="Mniejsze zdjęcia"
						>
							<MinusIcon className="size-5" />
						</button>
						<button
							type="button"
							onClick={gallery.zoomIn}
							disabled={!gallery.canZoomIn}
							className={iconButtonClass}
							aria-label="Większe zdjęcia"
						>
							<PlusIcon className="size-5" />
						</button>
					</fieldset>
				) : null}
			</div>

			{/* Placeholder plates already show what is still coming. */}
			<p className="sr-only" aria-live="polite">
				{pending && !message ? "Wczytywanie…" : ""}
			</p>
			{hasMore && message ? (
				<div className="mt-2 flex min-h-11 shrink-0 flex-wrap items-center gap-4">
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
				</div>
			) : message ? (
				<p role="alert" className="mt-4 shrink-0 font-medium text-ma-oxblood">
					{message}
				</p>
			) : null}

			{items.length ? (
				<>
					<p id="gallery-scroll-help" className="sr-only">
						Przewiń poziomo, aby zobaczyć kolejne zdjęcia. Uszczypnij ekran, aby
						zmienić ich wielkość.
					</p>
					<section
						ref={gallery.viewportRef}
						onScroll={gallery.onScroll}
						// biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll the photo rail.
						tabIndex={0}
						aria-label="Zdjęcia"
						aria-describedby="gallery-scroll-help"
						className="relative left-1/2 mt-6 min-h-0 w-[100dvw] flex-1 -translate-x-1/2 overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-gutter:stable] [touch-action:pan-x_pan-y] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ma-ink sm:mt-8"
					>
						<div
							data-gallery-spacer
							data-gallery-width={layout.width}
							data-gallery-loaded-end={layout.loadedWidth}
							aria-hidden
							className="h-px"
							style={{ width: layout.width }}
						/>
						<div
							className="absolute inset-0"
							style={{ opacity: gallery.viewportSize.width > 0 ? 1 : 0 }}
						>
							<AnimatePresence initial={false}>
								<GalleryLayer
									key={gallery.rows}
									items={items}
									rows={gallery.rows}
									geometry={layout.items}
									placeholders={layout.placeholders}
									width={layout.width}
									transition={transition}
									onSelect={onSelect}
								/>
							</AnimatePresence>
						</div>
					</section>
				</>
			) : (
				<div className="ma-empty mt-6 flex-1 sm:mt-8">
					<p className="font-serif text-3xl leading-tight">
						Jeszcze nikt nic nie wrzucił.
					</p>
				</div>
			)}
		</section>
	);
}
