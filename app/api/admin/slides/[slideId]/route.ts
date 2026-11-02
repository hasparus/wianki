import { z } from "zod";
import { denyAdminRequest } from "@/lib/auth/session";
import { run } from "@/lib/db";
import { jsonError, noStoreJson } from "@/lib/http";
import { siteFromRequest } from "@/lib/sites";
import {
	SLIDESHOW_MAX_SUBTITLE,
	SLIDESHOW_MAX_TITLE,
} from "@/lib/slideshow-protocol";

const updateSchema = z.object({
	title: z.string().trim().min(1).max(SLIDESHOW_MAX_TITLE),
	subtitle: z
		.string()
		.trim()
		.max(SLIDESHOW_MAX_SUBTITLE)
		.optional()
		.transform((value) => value || null),
});

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ slideId: string }> },
) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	const denied = await denyAdminRequest(request, site);
	if (denied) return denied;
	const parsed = updateSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return jsonError("Nieprawidłowa treść slajdu.", 400);
	const { slideId } = await params;
	let changed: number;
	try {
		changed = await run(
			"update slideshow_slides set title = ?, subtitle = ? where id = ? and site_id = ? and kind = 'text'",
			[parsed.data.title, parsed.data.subtitle, slideId, site.id],
		);
	} catch {
		return jsonError("Nie udało się zapisać slajdu.", 500);
	}
	if (!changed) return jsonError("Nie znaleziono slajdu tekstowego.", 404);
	return noStoreJson({ ok: true });
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ slideId: string }> },
) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	const denied = await denyAdminRequest(request, site);
	if (denied) return denied;
	const { slideId } = await params;
	let changed: number;
	try {
		changed = await run(
			"delete from slideshow_slides where id = ? and site_id = ?",
			[slideId, site.id],
		);
	} catch {
		return jsonError("Nie udało się usunąć slajdu.", 500);
	}
	if (!changed) return jsonError("Nie znaleziono slajdu.", 404);
	return noStoreJson({ ok: true });
}
