import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminSlides } from "@/lib/slideshow";
import { SlideEditor } from "./slide-editor";

export const metadata: Metadata = {
	title: "Paweł & Magdalena — edytor pokazu",
};

export default async function SlideEditorPage() {
	await requireAdmin();
	let slides: Awaited<ReturnType<typeof getAdminSlides>> = [];
	let error = "";
	try {
		slides = await getAdminSlides();
	} catch {
		error = "Nie udało się pobrać slajdów. Odśwież stronę.";
	}
	return <SlideEditor initialSlides={slides} initialError={error} />;
}
