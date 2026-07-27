import { useCallback, useState } from "react";
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
