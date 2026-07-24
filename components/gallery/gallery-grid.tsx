import Image from "next/image";
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
			<div className="mb-5 flex flex-wrap items-center justify-between gap-4">
				<h2 id="gallery-title" className="font-serif text-3xl font-bold">
					Galeria
				</h2>
				<button
					type="button"
					onClick={onRefresh}
					disabled={pending}
					className="min-h-11 rounded-full border-2 border-wedding-green px-5 font-bold hover:bg-wedding-rose/40 disabled:opacity-60"
				>
					{pending ? "Odświeżamy…" : "Odśwież galerię"}
				</button>
			</div>
			{message ? (
				<p role="alert" className="mb-4 font-semibold text-wedding-error">
					{message}
				</p>
			) : null}
			{items.length ? (
				<ul className="columns-2 gap-3 sm:columns-3 lg:columns-4">
					{items.map((item) => (
						<li key={item.id} className="mb-3 break-inside-avoid">
							<button
								type="button"
								onClick={() => onSelect(item)}
								className="group block w-full overflow-hidden rounded-2xl bg-wedding-rose/30 shadow-sm focus-visible:outline-4"
								aria-label="Powiększ zdjęcie"
							>
								<Image
									src={item.imageUrl}
									alt=""
									width={item.width ?? 1200}
									height={item.height ?? 900}
									unoptimized
									className="h-auto w-full transition duration-300 group-hover:scale-[1.02]"
								/>
							</button>
						</li>
					))}
				</ul>
			) : (
				<div className="rounded-[2rem] border border-dashed border-wedding-green/50 p-10 text-center">
					<p className="font-serif text-2xl font-bold">
						Pierwsze zdjęcia pojawią się tutaj.
					</p>
					<p className="mt-2">Może zaczniesz nasz wspólny album?</p>
				</div>
			)}
			{hasMore ? (
				<div className="mt-8 text-center">
					<button
						type="button"
						onClick={onLoadMore}
						disabled={pending}
						className="min-h-12 rounded-full bg-wedding-green px-7 font-bold text-wedding-rose disabled:opacity-60"
					>
						Pokaż więcej
					</button>
				</div>
			) : null}
		</section>
	);
}
