import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import {
	getAdminSlides,
	getSlideSeconds,
	SLIDESHOW_DEFAULT_SECONDS,
} from "@/lib/slideshow";
import { SlideEditor } from "./slide-editor";

export const metadata: Metadata = {
	title: "Paweł & Magdalena — edytor pokazu",
};

export default async function SlideEditorPage() {
	await requireAdmin();
	let slides: Awaited<ReturnType<typeof getAdminSlides>> = [];
	let slideSeconds = SLIDESHOW_DEFAULT_SECONDS;
	let error = "";
	try {
		[slides, slideSeconds] = await Promise.all([
			getAdminSlides(),
			getSlideSeconds(),
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
