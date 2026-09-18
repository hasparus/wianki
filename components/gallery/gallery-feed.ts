import { useCallback, useEffect, useState } from "react";
import type { GalleryItem, GalleryStats } from "@/lib/domain";

export type GalleryResponse = {
	items: GalleryItem[];
	nextCursor: string | null;
	stats: GalleryStats;
	error?: string;
};

async function fetchPage(cursor?: string | null) {
	const url = cursor
		? `/api/gallery?cursor=${encodeURIComponent(cursor)}`
		: "/api/gallery";
	const response = await fetch(url, { cache: "no-store" });
	const body = (await response.json()) as GalleryResponse;
	if (!response.ok) throw new Error(body.error ?? "Nie udało się odświeżyć.");
	return body;
}

/** New photos arrive at the front; pages already loaded by hand stay put. */
export function mergeFreshItems(
	current: GalleryItem[],
	incoming: GalleryItem[],
): GalleryItem[] {
	const known = new Set(current.map((item) => item.id));
	const fresh = incoming.filter((item) => !known.has(item.id));
	return fresh.length ? [...fresh, ...current] : current;
}

export function useGalleryFeed(initial: GalleryResponse) {
	const [items, setItems] = useState(initial.items);
	const [stats, setStats] = useState(initial.stats);
	const [cursor, setCursor] = useState(initial.nextCursor);
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState(initial.error ?? "");

	const refresh = useCallback(async () => {
		setPending(true);
		setMessage("");
		try {
			const page = await fetchPage();
			setItems(page.items);
			setCursor(page.nextCursor);
			setStats(page.stats);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Błąd odświeżania.");
		} finally {
			setPending(false);
		}
	}, []);

	/*
	 * The gallery is semi-fresh on its own: every ten seconds the first page is
	 * refetched and anything new is folded in above what is already on screen,
	 * so pages the guest loaded by hand survive. A guest who wants it exact
	 * reloads the page.
	 */
	useEffect(() => {
		const id = setInterval(async () => {
			if (document.hidden) return;
			try {
				const page = await fetchPage();
				setItems((current) => mergeFreshItems(current, page.items));
				setStats(page.stats);
			} catch {
				// A missed poll is not worth an alarm; the next one is ten seconds away.
			}
		}, 10_000);
		return () => clearInterval(id);
	}, []);

	const loadMore = useCallback(async () => {
		if (!cursor) return;
		setPending(true);
		try {
			const page = await fetchPage(cursor);
			setItems((current) => [...current, ...page.items]);
			setCursor(page.nextCursor);
			setStats(page.stats);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Błąd galerii.");
		} finally {
			setPending(false);
		}
	}, [cursor]);

	return { items, stats, cursor, pending, message, refresh, loadMore };
}
