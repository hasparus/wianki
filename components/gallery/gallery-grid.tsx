import {
	AnimatePresence,
	motion,
	type Transition,
	usePresence,
	useReducedMotion,
} from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { memo, useEffect } from "react";
import {
	type GalleryGeometry,
	type GalleryRows,
	horizontalGalleryLayout,
} from "@/components/gallery/horizontal-gallery";
import { useHorizontalGallery } from "@/components/gallery/use-horizontal-gallery";
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
	rows: GalleryRows;
	geometry: GalleryGeometry;
	onSelect: (item: GalleryItem) => void;
};

type ZoomDirection = "in" | "out";

type GalleryLayerProps = {
	items: GalleryItem[];
	rows: GalleryRows;
	geometry: GalleryGeometry[];
	width: number;
	direction: ZoomDirection;
	transition: Transition;
	reduceMotion: boolean;
	onSelect: (item: GalleryItem) => void;
};

const LAYER_TRANSITION = {
	duration: 0.24,
	ease: [0.22, 1, 0.36, 1],
} satisfies Transition;

const REDUCED_TRANSITION = { duration: 0 } satisfies Transition;

const Plate = memo(function Plate({
	item,
	rows,
	geometry,
	onSelect,
}: PlateProps) {
	const sizes =
		rows === 1
			? "(max-width: 640px) 90vw, 34rem"
			: rows === 2
				? "(max-width: 640px) 48vw, 17rem"
				: "(max-width: 640px) 32vw, 11rem";

	return (
		<li
			data-photo-id={item.id}
			data-gallery-x={geometry.x}
			data-gallery-width={geometry.width}
			className="absolute left-0 top-0 [contain:layout_paint]"
			style={{
				width: geometry.width,
				height: geometry.height,
				transform: `translate3d(${geometry.x}px, ${geometry.y}px, 0)`,
			}}
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
					sizes={sizes}
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

function GalleryLayer({
	items,
	rows,
	geometry,
	width,
	direction,
	transition,
	reduceMotion,
	onSelect,
}: GalleryLayerProps) {
	const [isPresent, safeToRemove] = usePresence();

	useEffect(() => {
		if (isPresent) return;
		if (reduceMotion) {
			safeToRemove();
			return;
		}
		const timer = window.setTimeout(safeToRemove, 260);
		return () => window.clearTimeout(timer);
	}, [isPresent, reduceMotion, safeToRemove]);

	return (
		<motion.ul
			data-gallery-current={isPresent ? "" : undefined}
			data-gallery-width={width}
			aria-hidden={!isPresent}
			className={`absolute inset-y-0 left-0 origin-center ${isPresent ? "z-0" : "pointer-events-none z-10"}`}
			initial={{ scale: direction === "in" ? 0.97 : 1.03 }}
			animate={{ scale: 1 }}
			transition={transition}
			style={{
				width,
				opacity: isPresent ? 1 : 0,
				transition: reduceMotion
					? "none"
					: "opacity 240ms cubic-bezier(0.22, 1, 0.36, 1)",
			}}
		>
			{items.map((item, index) => {
				const itemGeometry = geometry[index];
				return itemGeometry ? (
					<Plate
						key={item.id}
						item={item}
						rows={rows}
						geometry={itemGeometry}
						onSelect={onSelect}
					/>
				) : null;
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
	const gallery = useHorizontalGallery({
		itemCount: items.length,
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
	);

	return (
		<section aria-labelledby="gallery-title">
			<h2 id="gallery-title" className="sr-only">
				Galeria
			</h2>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="flex items-baseline gap-2" aria-live="polite">
					<span className="ma-numeral text-3xl">{photoCount}</span>
					<span className="ma-label">{photoCountNoun(photoCount)}</span>
				</p>
				<div className="flex items-center gap-3">
					{items.length ? (
						<fieldset className="flex items-center" aria-label="Wielkość zdjęć">
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
						className="relative left-1/2 mt-12 h-[22rem] w-[100dvw] -translate-x-1/2 overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-gutter:stable] [touch-action:pan-x] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ma-ink sm:h-[30rem] lg:h-[34rem]"
					>
						<div
							data-gallery-spacer
							data-gallery-width={layout.width}
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
									width={layout.width}
									direction={gallery.zoomDirection}
									transition={transition}
									reduceMotion={reduceMotion}
									onSelect={onSelect}
								/>
							</AnimatePresence>
						</div>
					</section>
				</>
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
