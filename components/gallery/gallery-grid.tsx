import Image from "next/image";
import Link from "next/link";
import type { GalleryItem } from "@/lib/domain";

type GalleryGridProps = {
	items: GalleryItem[];
	hasMore: boolean;
	pending: boolean;
	message: string;
	onRefresh: () => void;
	onLoadMore: () => void;
	onSelect: (item: GalleryItem) => void;
};

export function GalleryGrid({
	items,
	hasMore,
	pending,
	message,
	onRefresh,
	onLoadMore,
	onSelect,
}: GalleryGridProps) {
	return (
		<section aria-labelledby="gallery-title">
			<div className="flex flex-wrap items-end justify-between gap-6">
				<div>
					<h2
						id="gallery-title"
						className="font-serif text-[clamp(2.25rem,6vw,3.75rem)] leading-[0.95]"
					>
						Galeria
					</h2>
					<hr className="ma-rule mt-5" />
				</div>
				<div className="flex flex-wrap gap-3">
					<Link href="/pokaz" className="ma-action ma-action--ghost">
						Pokaz slajdów
					</Link>
					<button
						type="button"
						onClick={onRefresh}
						disabled={pending}
						className="ma-action ma-action--ghost"
					>
						{pending ? "Odświeżamy…" : "Odśwież"}
					</button>
				</div>
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
									className="h-auto w-full transition-opacity duration-300 group-hover:opacity-85"
								/>
							</button>
						</li>
					))}
				</ul>
			) : (
				<div className="ma-empty mt-12">
					<p className="max-w-md font-serif text-3xl leading-tight">
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
