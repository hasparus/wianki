import Image from "next/image";
import { useEffect } from "react";
import type { GalleryItem } from "@/lib/domain";

export function PhotoLightbox({
	item,
	onClose,
}: {
	item: GalleryItem | null;
	onClose: () => void;
}) {
	useEffect(() => {
		if (!item) return;
		function close(event: KeyboardEvent) {
			if (event.key === "Escape") onClose();
		}
		window.addEventListener("keydown", close);
		return () => window.removeEventListener("keydown", close);
	}, [item, onClose]);

	if (!item) return null;

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Powiększone zdjęcie"
			className="fixed inset-0 z-50 grid place-items-center bg-[var(--wedding-overlay)] p-4"
		>
			<button
				type="button"
				aria-label="Zamknij powiększone zdjęcie"
				onClick={onClose}
				className="absolute inset-0"
			/>
			<button
				type="button"
				onClick={onClose}
				className="absolute right-4 top-4 z-10 min-h-11 rounded-full bg-wedding-ivory px-5 font-bold text-wedding-green"
			>
				Zamknij
			</button>
			<Image
				src={item.imageUrl}
				alt=""
				width={item.width ?? 1600}
				height={item.height ?? 1200}
				unoptimized
				className="z-10 max-h-[88vh] w-auto max-w-full rounded-2xl object-contain"
			/>
		</div>
	);
}
