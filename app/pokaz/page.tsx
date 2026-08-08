import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SlideshowClient } from "@/components/slideshow/slideshow-client";
import { readAdminSession, readGuestSession } from "@/lib/auth/session";
import {
	getSlideSeconds,
	getSlideshowDeck,
	getSlideshowJoinInfo,
	SLIDESHOW_DEFAULT_SECONDS,
	type SlideshowDeck,
} from "@/lib/slideshow";

export const metadata: Metadata = {
	title: "Paweł & Magdalena — pokaz slajdów",
};

async function loadDeck(): Promise<SlideshowDeck> {
	try {
		return await getSlideshowDeck();
	} catch {
		return { slides: [], source: "auto" };
	}
}

export default async function SlideshowPage() {
	const guest = await readGuestSession();
	if (!guest && !(await readAdminSession())) redirect("/login");
	const [deck, join, slideSeconds] = await Promise.all([
		loadDeck(),
		getSlideshowJoinInfo().catch(() => null),
		getSlideSeconds().catch(() => SLIDESHOW_DEFAULT_SECONDS),
	]);
	return (
		<SlideshowClient deck={deck} join={join} slideSeconds={slideSeconds} />
	);
}
