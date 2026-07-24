import { GalleryClient } from "@/components/gallery-client";
import { requireGuest } from "@/lib/auth/session";
import { getGalleryPage, getGalleryStats } from "@/lib/gallery";

async function loadInitialGallery() {
	try {
		const [page, stats] = await Promise.all([
			getGalleryPage(),
			getGalleryStats(),
		]);
		return { ...page, stats };
	} catch {
		return {
			items: [],
			nextCursor: null,
			stats: { approvedPhotos: 0, contributingGuests: 0 },
			error: "Galeria jest chwilowo niedostępna. Spróbuj odświeżyć za moment.",
		};
	}
}

export default async function Home() {
	await requireGuest();
	return <GalleryClient initial={await loadInitialGallery()} />;
}
