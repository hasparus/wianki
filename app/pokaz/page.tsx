import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SlideshowClient } from "@/components/slideshow/slideshow-client";
import { readAdminSession, readGuestSession } from "@/lib/auth/session";
import { requireSite, type Site } from "@/lib/sites";
import {
	getSlideSeconds,
	getSlideshowDeck,
	getSlideshowJoinInfo,
	type SlideshowDeck,
} from "@/lib/slideshow";
import { SLIDESHOW_DEFAULT_SECONDS } from "@/lib/slideshow-protocol";

export const metadata: Metadata = {
	title: "Pokaz slajdów",
};

async function loadDeck(site: Site): Promise<SlideshowDeck> {
	try {
		return await getSlideshowDeck(site.id);
	} catch {
		return { slides: [], source: "auto" };
	}
}

export default async function SlideshowPage() {
	const site = await requireSite();
	const guest = await readGuestSession(site);
	if (!guest && !(await readAdminSession(site))) redirect("/login");
	const [deck, join, slideSeconds] = await Promise.all([
		loadDeck(site),
		getSlideshowJoinInfo(site).catch(() => null),
		getSlideSeconds(site.id).catch(() => SLIDESHOW_DEFAULT_SECONDS),
	]);
	return (
		<SlideshowClient deck={deck} join={join} slideSeconds={slideSeconds} />
	);
}
