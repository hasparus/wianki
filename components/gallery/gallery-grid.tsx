import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/slideshow/icons";
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

export function GalleryGrid({
	items,
	photoCount,
	hasMore,
	pending,
	message,
	onLoadMore,
	onSelect,
}: GalleryGridProps) {
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
				<Link href="/pokaz" className="ma-action ma-action--ghost">
					Pokaz slajdów
					<ArrowRightIcon />
				</Link>
			</div>

			{message ? (
				<p role="alert" className="mt-8 font-medium text-ma-oxblood">
					{message}
				</p>
			) : null}

			{items.length ? (
				<ul className="mt-12 columns-2 gap-4 sm:columns-3 lg:columns-4 lg:gap-6">
					{items.map((item) => (
						<li key={item.id} className="mb-4 break-inside-avoid lg:mb-6">
							<button
								type="button"
								onClick={() => onSelect(item)}
								className="group block w-full bg-ma-ash/40 focus-visible:outline-2 focus-visible:outline-ma-ink"
								aria-label="Powiększ zdjęcie"
							>
								<Image
									src={item.imageUrl}
									alt=""
									width={item.width ?? 1200}
									height={item.height ?? 900}
									unoptimized
									className="h-auto w-full group-hover:opacity-85"
								/>
							</button>
						</li>
					))}
				</ul>
			) : (
				<div className="ma-empty mt-12">
					<p className="font-serif text-3xl leading-tight">
						Jeszcze nikt nic nie wrzucił.
					</p>
				</div>
			)}

			{hasMore ? (
				<div className="mt-14">
					<button
						type="button"
						onClick={onLoadMore}
						disabled={pending}
						className="ma-action"
					>
						Pokaż więcej
					</button>
				</div>
			) : null}
		</section>
	);
}
