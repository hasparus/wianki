import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { requireSite } from "@/lib/sites";
import { getAdminSlides, getSlideSeconds } from "@/lib/slideshow";
import { SLIDESHOW_DEFAULT_SECONDS } from "@/lib/slideshow-protocol";
import { SlideEditor } from "./slide-editor";

export const metadata: Metadata = {
	title: "Edytor pokazu",
};

export default async function SlideEditorPage() {
	const site = await requireSite();
	await requireAdmin(site);
	let slides: Awaited<ReturnType<typeof getAdminSlides>> = [];
	let slideSeconds = SLIDESHOW_DEFAULT_SECONDS;
	let error = "";
	try {
		[slides, slideSeconds] = await Promise.all([
			getAdminSlides(site.id),
			getSlideSeconds(site.id),
		]);
	} catch {
		error = "Nie udało się pobrać slajdów. Odśwież stronę.";
	}
	return (
		<SlideEditor
			initialSlides={slides}
			initialError={error}
			initialSlideSeconds={slideSeconds}
		/>
	);
}
