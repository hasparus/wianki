import { z } from "zod";
import { denyAdminRequest, readAdminSession } from "@/lib/auth/session";
import { all, batch, first, placeholders } from "@/lib/db";
import { GALLERY_ELIGIBLE } from "@/lib/gallery";
import { jsonError, noStoreJson } from "@/lib/http";
import { siteFromRequest } from "@/lib/sites";
import { getAdminSlides, isValidSlideOrder } from "@/lib/slideshow";
import {
	SLIDESHOW_MAX_SUBTITLE,
	SLIDESHOW_MAX_TITLE,
} from "@/lib/slideshow-protocol";

const createSchema = z.union([
	z.object({ photoIds: z.array(z.uuid()).min(1).max(100) }),
	z.object({
		title: z.string().trim().min(1).max(SLIDESHOW_MAX_TITLE),
		subtitle: z
			.string()
			.trim()
			.max(SLIDESHOW_MAX_SUBTITLE)
			.optional()
			.transform((value) => value || null),
	}),
]);

const reorderSchema = z.object({
	order: z.array(z.uuid()).min(1).max(500),
});

async function nextPosition(siteId: string) {
	const row = await first<{ position: number | null }>(
		"select max(position) as position from slideshow_slides where site_id = ?",
		[siteId],
	);
	return (row?.position ?? 0) + 1;
}

export async function GET(request: Request) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	if (!(await readAdminSession(site))) return jsonError("Brak dostępu.", 401);
	try {
		return noStoreJson({ slides: await getAdminSlides(site.id) });
	} catch {
		return jsonError("Nie udało się pobrać slajdów.", 500);
	}
}

export async function POST(request: Request) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	const denied = await denyAdminRequest(request, site);
	if (denied) return denied;
	const parsed = createSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return jsonError("Nieprawidłowe dane slajdu.", 400);

	try {
		if ("photoIds" in parsed.data) {
			const { photoIds } = parsed.data;
			const eligible = await all<{ id: string }>(
				`select id from photos where site_id = ? and id in (${placeholders(photoIds.length)}) and ${GALLERY_ELIGIBLE}`,
				[site.id, ...photoIds],
			);
			const taken = await all<{ photo_id: string }>(
				`select photo_id from slideshow_slides where site_id = ? and photo_id in (${placeholders(photoIds.length)})`,
				[site.id, ...photoIds],
			);
			const takenIds = new Set(taken.map((row) => row.photo_id));
			const eligibleIds = new Set(eligible.map((row) => row.id));
			const toAdd = photoIds.filter(
				(id) => eligibleIds.has(id) && !takenIds.has(id),
			);
			if (toAdd.length > 0) {
				const start = await nextPosition(site.id);
				await batch(
					toAdd.map((photoId, index) => ({
						sql: "insert into slideshow_slides (id, site_id, kind, photo_id, position) values (?, ?, 'photo', ?, ?)",
						params: [crypto.randomUUID(), site.id, photoId, start + index],
					})),
				);
			}
			return noStoreJson({
				added: toAdd.length,
				skipped: photoIds.length - toAdd.length,
			});
		}

		await batch([
			{
				sql: "insert into slideshow_slides (id, site_id, kind, title, subtitle, position) values (?, ?, 'text', ?, ?, ?)",
				params: [
					crypto.randomUUID(),
					site.id,
					parsed.data.title,
					parsed.data.subtitle,
					await nextPosition(site.id),
				],
			},
		]);
		return noStoreJson({ added: 1, skipped: 0 });
	} catch {
		return jsonError("Nie udało się dodać slajdów.", 500);
	}
}

export async function PATCH(request: Request) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	const denied = await denyAdminRequest(request, site);
	if (denied) return denied;
	const parsed = reorderSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) return jsonError("Nieprawidłowa kolejność.", 400);
	try {
		const rows = await all<{ id: string }>(
			"select id from slideshow_slides where site_id = ?",
			[site.id],
		);
		if (
			!isValidSlideOrder(
				rows.map((row) => row.id),
				parsed.data.order,
			)
		) {
			return jsonError(
				"Kolejność nie zgadza się z aktualną listą slajdów. Odśwież edytor.",
				409,
			);
		}
		// One batch rather than one update per slide: a renumbering that fails
		// halfway would leave the deck in an order nobody asked for.
		await batch(
			parsed.data.order.map((id, index) => ({
				sql: "update slideshow_slides set position = ? where id = ? and site_id = ?",
				params: [index + 1, id, site.id],
			})),
		);
		return noStoreJson({ ok: true });
	} catch {
		return jsonError("Nie udało się zapisać kolejności.", 500);
	}
}
