import Image from "next/image";
import type { UploadItem } from "@/components/upload/types";

export function UploadedPhotos({ items }: { items: UploadItem[] }) {
	if (!items.length) return null;
	return (
		<section aria-labelledby="uploaded-photos-title" className="mt-10">
			<h3 id="uploaded-photos-title" className="ma-label">
				Twoje wysłane zdjęcia
			</h3>
			<ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
				{items.map((item) => (
					<li key={item.id}>
						{item.previewUrl ? (
							<Image
								src={item.previewUrl}
								alt={`Wysłane zdjęcie ${item.file.name}`}
								width={320}
								height={320}
								unoptimized
								className="aspect-square w-full object-cover"
							/>
						) : (
							<span className="flex aspect-square w-full items-center justify-center overflow-hidden border border-ma-ash p-2 text-center text-xs text-ma-pine">
								{item.file.name}
							</span>
						)}
					</li>
				))}
			</ul>
			<p className="mt-3 text-sm text-ma-pine">
				Pojawią się w galerii, gdy tylko je zatwierdzimy.
			</p>
		</section>
	);
}
