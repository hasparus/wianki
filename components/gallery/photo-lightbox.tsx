import Image from "next/image";
import { useEffect } from "react";
import type { GalleryItem } from "@/lib/domain";

/**
 * Placement. The arrangement recedes and the chosen photograph is set over the
 * bronze suiban plane, off-axis, with its one control on the vessel strip.
 */
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
			className="ma-alcove fixed inset-0 z-50 flex flex-col"
		>
			<button
				type="button"
				aria-label="Zamknij powiększone zdjęcie"
				onClick={onClose}
				className="absolute inset-0"
			/>
			{/*
			 * The plate is seated on the suiban rather than floating over it: the
			 * arrangement meets its base, and the plane below it is bronze instead
			 * of a pinched sliver of the receded gallery.
			 */}
			<div className="relative z-10 flex min-h-0 grow items-end justify-center p-4 pb-0 sm:p-10 sm:pb-0 lg:justify-end lg:pr-[12%]">
				<Image
					src={item.imageUrl}
					alt=""
					width={item.width ?? 1600}
					height={item.height ?? 1200}
					unoptimized
					placeholder={item.blurDataUrl ? "blur" : "empty"}
					blurDataURL={item.blurDataUrl ?? undefined}
					className="ma-placed max-h-full w-auto max-w-full object-contain"
				/>
			</div>
			<div className="ma-suiban relative flex h-[18vh] min-h-28 shrink-0 items-end justify-end border-t border-ma-pine px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-10">
				<button type="button" onClick={onClose} className="ma-stage-action">
					Zamknij
				</button>
			</div>
		</div>
	);
}
