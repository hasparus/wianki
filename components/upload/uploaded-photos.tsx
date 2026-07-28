import Image from "next/image";
import type { UploadItem } from "@/components/upload/types";

export function UploadedPhotos({ items }: { items: UploadItem[] }) {
	if (!items.length) return null;
	return (
		<section aria-labelledby="uploaded-photos-title" className="mt-6">
			<h3 id="uploaded-photos-title" className="font-serif text-xl font-bold">
				Twoje wysłane zdjęcia
			</h3>
			<p className="mt-1 text-sm leading-6">
				Pojawią się w galerii, gdy tylko je zatwierdzimy.
			</p>
			<ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
				{items.map((item) => (
					<li key={item.id}>
						{item.previewUrl ? (
							<Image
								src={item.previewUrl}
								alt={`Wysłane zdjęcie ${item.file.name}`}
								width={320}
								height={320}
								unoptimized
								className="aspect-square w-full rounded-xl border border-wedding-rose/60 object-cover"
							/>
						) : (
							<span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-white/75 p-2 text-center text-xs">
								{item.file.name}
							</span>
						)}
					</li>
				))}
			</ul>
		</section>
	);
}
