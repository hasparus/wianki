import { z } from "zod";
import { denyAdminRequest, readAdminSession } from "@/lib/auth/session";
import { jsonError, noStoreJson } from "@/lib/http";
import { getAdminSlides, isValidSlideOrder } from "@/lib/slideshow";
import {
	SLIDESHOW_MAX_SUBTITLE,
	SLIDESHOW_MAX_TITLE,
} from "@/lib/slideshow-protocol";
import { supabaseAdmin } from "@/lib/supabase/server";

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

async function nextPosition() {
	const { data, error } = await supabaseAdmin()
		.from("slideshow_slides")
		.select("position")
		.order("position", { ascending: false })
		.limit(1);
	if (error) throw error;
	return (data?.[0]?.position ?? 0) + 1;
}

export async function GET() {
	if (!(await readAdminSession())) return jsonError("Brak dostępu.", 401);
	try {
		return noStoreJson({ slides: await getAdminSlides() });
	} catch {
		return jsonError("Nie udało się pobrać slajdów.", 500);
	}
}

export async function POST(request: Request) {
	const denied = await denyAdminRequest(request);
	if (denied) return denied;
	const parsed = createSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return jsonError("Nieprawidłowe dane slajdu.", 400);
	const supabase = supabaseAdmin();

	try {
		if ("photoIds" in parsed.data) {
			const { photoIds } = parsed.data;
			const { data: eligible, error: photosError } = await supabase
				.from("photos")
				.select("id")
				.in("id", photoIds)
				.eq("hot_status", "uploaded")
				.eq("moderation_status", "approved");
			if (photosError) throw photosError;
			const { data: taken, error: takenError } = await supabase
				.from("slideshow_slides")
				.select("photo_id")
				.in("photo_id", photoIds);
			if (takenError) throw takenError;
			const takenIds = new Set(
				(taken ?? []).map((row) => row.photo_id).filter(Boolean),
			);
			const eligibleIds = new Set((eligible ?? []).map((row) => row.id));
			const toAdd = photoIds.filter(
				(id) => eligibleIds.has(id) && !takenIds.has(id),
			);
			if (toAdd.length > 0) {
				const start = await nextPosition();
				const { error } = await supabase.from("slideshow_slides").insert(
					toAdd.map((photoId, index) => ({
						kind: "photo" as const,
						photo_id: photoId,
						position: start + index,
					})),
				);
				if (error) throw error;
			}
			return noStoreJson({
				added: toAdd.length,
				skipped: photoIds.length - toAdd.length,
			});
		}

		const { error } = await supabase.from("slideshow_slides").insert({
			kind: "text" as const,
			title: parsed.data.title,
			subtitle: parsed.data.subtitle,
			position: await nextPosition(),
		});
		if (error) throw error;
		return noStoreJson({ added: 1, skipped: 0 });
	} catch {
		return jsonError("Nie udało się dodać slajdów.", 500);
	}
}

export async function PATCH(request: Request) {
	const denied = await denyAdminRequest(request);
	if (denied) return denied;
	const parsed = reorderSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) return jsonError("Nieprawidłowa kolejność.", 400);
	const supabase = supabaseAdmin();
	try {
		const { data, error } = await supabase
			.from("slideshow_slides")
			.select("id,kind,photo_id,title,subtitle");
		if (error) throw error;
		const rows = data ?? [];
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
		// One upsert rather than one update per slide: a renumbering that fails
		// halfway would leave the deck in an order nobody asked for.
		const { error: reorderError } = await supabase
			.from("slideshow_slides")
			.upsert(
				rows.map((row) => ({
					...row,
					position: parsed.data.order.indexOf(row.id) + 1,
				})),
			);
		if (reorderError) throw reorderError;
		return noStoreJson({ ok: true });
	} catch {
		return jsonError("Nie udało się zapisać kolejności.", 500);
	}
}
