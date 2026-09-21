import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, memo } from "react";
import type { GalleryRows } from "@/components/gallery/horizontal-gallery";
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
	onSelect: (item: GalleryItem) => void;
};

const Plate = memo(function Plate({ item, rows, onSelect }: PlateProps) {
	const closestRatio =
		item.width && item.height ? `${item.width} / ${item.height}` : "4 / 3";
	const sizes =
		rows === 1
			? "(max-width: 640px) 90vw, 34rem"
			: rows === 2
				? "(max-width: 640px) 48vw, 17rem"
				: "(max-width: 640px) 32vw, 11rem";

	return (
		<li
			data-photo-id={item.id}
			className="relative h-full shrink-0 [contain:layout_paint]"
			style={{ aspectRatio: rows === 1 ? closestRatio : "1 / 1" }}
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
	const gallery = useHorizontalGallery({
		itemCount: items.length,
		hasMore,
		pending,
		onLoadMore,
	});
	const gridStyle = {
		gridTemplateRows: `repeat(${gallery.rows}, minmax(0, 1fr))`,
		gridAutoColumns: "auto",
	} satisfies CSSProperties;

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
						<ul
							ref={gallery.contentRef}
							className="grid h-full min-w-full w-max grid-flow-col gap-0.5"
							style={gridStyle}
						>
							{items.map((item) => (
								<Plate
									key={item.id}
									item={item}
									rows={gallery.rows}
									onSelect={onSelect}
								/>
							))}
						</ul>
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
