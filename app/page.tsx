import { GalleryClient } from "@/components/gallery-client";
import { PlatformHome } from "@/components/platform/home";
import { requireGuest } from "@/lib/auth/session";
import { getGalleryPage, getGalleryStats } from "@/lib/gallery";
import { currentSite } from "@/lib/sites";

async function loadInitialGallery(siteId: string) {
	try {
		const [page, stats] = await Promise.all([
			getGalleryPage(siteId),
			getGalleryStats(siteId),
		]);
		return { ...page, stats };
	} catch {
		return {
			items: [],
			nextCursor: null,
			stats: { approvedPhotos: 0 },
			error: "Galeria jest chwilowo niedostępna. Spróbuj odświeżyć za moment.",
		};
	}
}

/** The platform host shows the console's front door; a site host, its gallery. */
export default async function Home() {
	const site = await currentSite();
	if (!site) return <PlatformHome />;
	await requireGuest(site);
	return (
		<GalleryClient
			title={site.title}
			initial={await loadInitialGallery(site.id)}
		/>
	);
}
